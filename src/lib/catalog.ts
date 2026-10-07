import "server-only";
import { hasSupabase } from "./config";
import { serviceClient } from "./supabase";
import { demoBooks } from "./demo";
import type { Book } from "./types";
const fields =
  "id,slug,title_bn,title_en,author_bn,author_en,description_bn,description_en,category,price_paisa,pages,language,cover_path,cover_style,published,is_demo,featured,archived_at,created_at";
export async function getBooks(admin = false): Promise<Book[]> {
  if (!hasSupabase()) return demoBooks;
  let query = serviceClient()
    .from("books")
    .select(`${fields},book_formats(format${admin ? ",original_name" : ""}),book_previews(preview_pages${admin ? ",source_page_count,source_kind" : ""})`)
    .order("created_at", { ascending: false });
  if (!admin) query = query.eq("published", true).is("archived_at", null);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(({ book_formats, book_previews, ...book }) => {
    const formats = book_formats as { format: string; original_name?: string }[];
    const rawPreview = book_previews as unknown as { preview_pages: number; source_page_count?: number; source_kind?: "book_pdf" | "sample_pdf" } | { preview_pages: number; source_page_count?: number; source_kind?: "book_pdf" | "sample_pdf" }[] | null;
    const preview = Array.isArray(rawPreview) ? rawPreview[0] : rawPreview;
    return {
      ...book,
      formats: formats.map((f) => f.format.toUpperCase()),
      preview_pages: preview?.preview_pages || 0,
      ...(admin ? { preview_source_pages: preview?.source_page_count, preview_source_kind: preview?.source_kind } : {}),
      ...(admin ? { format_names: Object.fromEntries(formats.map((f) => [f.format, f.original_name || ""])) } : {}),
    };
  }) as Book[];
}
export async function getBook(slug: string) {
  return (await getBooks()).find((book) => book.slug === slug) || null;
}
