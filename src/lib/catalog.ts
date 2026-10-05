import "server-only";
import { hasSupabase } from "./config";
import { serviceClient } from "./supabase";
import { demoBooks } from "./demo";
import type { Book } from "./types";
const fields =
  "id,slug,title_bn,title_en,author_bn,author_en,description_bn,description_en,category,price_paisa,pages,language,cover_path,cover_style,published,is_demo,featured,created_at";
export async function getBooks(admin = false): Promise<Book[]> {
  if (!hasSupabase()) return demoBooks;
  let query = serviceClient()
    .from("books")
    .select(`${fields},book_formats(format${admin ? ",original_name" : ""})`)
    .order("created_at", { ascending: false });
  if (!admin) query = query.eq("published", true);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(({ book_formats, ...book }) => {
    const formats = book_formats as { format: string; original_name?: string }[];
    return {
      ...book,
      formats: formats.map((f) => f.format.toUpperCase()),
      ...(admin ? { format_names: Object.fromEntries(formats.map((f) => [f.format, f.original_name || ""])) } : {}),
    };
  }) as Book[];
}
export async function getBook(slug: string) {
  return (await getBooks()).find((book) => book.slug === slug) || null;
}
