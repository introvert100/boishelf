import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "./http";
import { inspectPdf } from "./preview-pdf";

export async function savedPdfPageCount(db: SupabaseClient, bookId: string) {
  const { data: format, error: formatError } = await db.from("book_formats")
    .select("storage_path").eq("book_id", bookId).eq("format", "pdf").maybeSingle();
  if (formatError) throw formatError;
  if (!format) throw new AppError(404, "Upload a PDF ebook before detecting its pages.");

  const { data: preview, error: previewError } = await db.from("book_previews")
    .select("source_kind,source_path,source_page_count").eq("book_id", bookId).maybeSingle();
  if (previewError) throw previewError;
  if (preview?.source_kind === "book_pdf" && preview.source_path === format.storage_path
    && Number.isInteger(preview.source_page_count) && preview.source_page_count > 0)
    return preview.source_page_count as number;

  const { data: file, error: downloadError } = await db.storage.from("ebooks").download(format.storage_path);
  if (downloadError || !file) throw downloadError || new AppError(503, "Could not read the PDF to detect its pages.");
  const pages = await inspectPdf(new Uint8Array(await file.arrayBuffer()));
  if (!preview) await cachePdfPageCount(db, bookId, format.storage_path, pages);
  return pages;
}

export async function cachePdfPageCount(db: SupabaseClient, bookId: string, path: string, pages: number) {
  const { error } = await db.rpc("save_book_preview", {
    p_book: bookId, p_expected_path: null, p_expected_source: null,
    p_source_kind: "book_pdf", p_source_path: path, p_source_pages: pages,
    p_preview_path: null, p_preview_pages: 0,
  });
  if (error) throw error;
}

export async function savePdfPageCount(db: SupabaseClient, bookId: string, pages: number) {
  const { error } = await db.from("books").update({ pages }).eq("id", bookId);
  if (error) throw error;
}
