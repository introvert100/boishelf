import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, logEvent } from "./http";
import { makePreviewPdf, PreviewPdfError } from "./preview-pdf";
import { queueStorageCleanup, runStorageCleanup } from "./storage-cleanup";

export type EbookKind = "pdf" | "epub";
type UploadTicket = { bookId: string; kind: EbookKind; path: string; name: string; size: number; expires: number };

function signature(value: string) {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Upload signing is not configured");
  return createHmac("sha256", key).update(value).digest();
}

export function issueUploadTicket(input: Omit<UploadTicket, "expires">) {
  const payload = Buffer.from(JSON.stringify({ ...input, expires: Date.now() + 2 * 60 * 60 * 1000 })).toString("base64url");
  return `${payload}.${signature(payload).toString("base64url")}`;
}

export function readUploadTicket(ticket: unknown): UploadTicket {
  if (typeof ticket !== "string" || ticket.length > 1200) throw new AppError(400, "Upload session is invalid. Choose the file again.");
  const [payload, provided, extra] = ticket.split(".");
  if (!payload || !provided || extra) throw new AppError(400, "Upload session is invalid. Choose the file again.");
  const expected = signature(payload);
  let actual: Buffer;
  try { actual = Buffer.from(provided, "base64url"); } catch { throw new AppError(400, "Upload session is invalid. Choose the file again."); }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new AppError(400, "Upload session is invalid. Choose the file again.");
  let value: UploadTicket;
  try { value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); }
  catch { throw new AppError(400, "Upload session is invalid. Choose the file again."); }
  if (!value || value.expires < Date.now() || !/^[0-9a-f-]{36}$/i.test(value.bookId)
    || !["pdf", "epub"].includes(value.kind) || !value.path.startsWith(`${value.bookId}/`)
    || !value.path.endsWith(`.${value.kind}`) || !Number.isInteger(value.size) || value.size < 1
    || value.size > 30 * 1024 * 1024 || typeof value.name !== "string" || value.name.length > 120)
    throw new AppError(400, "Upload session expired or invalid. Choose the file again.");
  return value;
}

export function uploadFailure(error: unknown, stage: string, kind?: string) {
  const raw = error as { statusCode?: string | number; status?: number; code?: string; name?: string; message?: string };
  const status = Number(raw?.statusCode || raw?.status || 0);
  const code = typeof raw?.code === "string" && /^[A-Z0-9_]+$/i.test(raw.code) ? raw.code.slice(0, 32) : "unknown";
  const name = typeof raw?.name === "string" && /^[A-Za-z]+$/.test(raw.name) ? raw.name.slice(0, 32) : "unknown";
  const requestId = crypto.randomUUID();
  logEvent("upload_failed", { requestId, stage, kind: kind || "unknown", code, status, name });
  let problem: AppError;
  if (error instanceof AppError) problem = error;
  else if (error instanceof PreviewPdfError) problem = new AppError(400, error.message);
  else if (status === 413 || /file size|payload too large|exceed.*size/i.test(raw?.message || ""))
    problem = new AppError(413, "The file exceeds the Supabase Storage limit. In Supabase Storage settings, allow ebooks up to 30 MB.");
  else if (status === 400 && /mime|content.type/i.test(raw?.message || ""))
    problem = new AppError(400, "Supabase rejected this file type. Check that the private ebook bucket accepts PDF and EPUB.");
  else if (code === "PGRST202" || /Could not find the function/i.test(raw?.message || ""))
    problem = new AppError(503, "The book upload database function is missing. Apply the latest BoiShelf migration in Supabase, then retry.");
  else if (stage === "storage_upload" || stage === "storage_read")
    problem = new AppError(503, "Supabase Storage could not save or read this file. Check the private bucket, its size limit, and Storage logs.");
  else if (stage === "database_save")
    problem = new AppError(503, "The file reached Storage, but the book record could not be updated. Check Supabase database logs.");
  else problem = new AppError(503, "The upload could not be completed. Check the request ID in Render logs.");
  return Response.json({ error: problem.message, requestId }, { status: problem.status });
}

export async function commitEbook(db: SupabaseClient, input: {
  bookId: string; kind: EbookKind; path: string; bytes: Uint8Array; name: string; size: number;
}) {
  const { bookId, kind, path, bytes, name, size } = input;
  const { data: preview, error: previewError } = kind === "pdf"
    ? await db.from("book_previews").select("source_kind,preview_pages,preview_path,source_path")
      .eq("book_id", bookId).maybeSingle()
    : { data: null, error: null };
  if (previewError) throw previewError;
  const excerpt = kind === "pdf" && preview && preview.preview_pages > 0
    ? await makePreviewPdf(bytes, preview.preview_pages, true) : null;
  const excerptPath = excerpt ? `${bookId}/previews/${crypto.randomUUID()}.pdf` : null;
  if (excerptPath && excerpt) {
    const { error } = await db.storage.from("ebooks")
      .upload(excerptPath, excerpt.bytes, { contentType: "application/pdf", upsert: false });
    if (error) throw error;
  }
  try {
    const { error: save } = excerpt && excerptPath
      ? await db.rpc("replace_pdf_with_preview", {
          p_book: bookId, p_path: path, p_name: name, p_size: size,
          p_preview_path: excerptPath, p_preview_pages: preview!.preview_pages,
          p_source_pages: excerpt.sourcePages, p_expected_path: preview!.preview_path,
        })
      : kind === "pdf" ? await db.rpc("replace_pdf_without_preview", {
          p_book: bookId, p_path: path, p_name: name, p_size: size,
          p_expected_path: preview?.preview_path || null,
        })
      : await db.from("book_formats").upsert({
          book_id: bookId, format: kind, storage_path: path, original_name: name, size_bytes: size,
        }, { onConflict: "book_id,format" });
    if (save?.message.includes("preview_changed"))
      throw new AppError(409, "The preview changed in another tab. Refresh and retry the PDF upload.");
    if (save?.message.includes("book_archived"))
      throw new AppError(409, "Restore this archived book before changing its files.");
    if (save) throw save;
  } catch (error) {
    if (excerptPath) {
      try { await db.storage.from("ebooks").remove([excerptPath]); }
      catch { /* Keep the save error. */ }
    }
    throw error;
  }
  if (excerptPath) await queueStorageCleanup(bookId, [
    { bucket: "ebooks", path: preview?.preview_path || null },
    { bucket: "ebooks", path: preview?.source_kind === "sample_pdf" ? preview.source_path : null },
  ]);
  else if (kind === "pdf") {
    try { await runStorageCleanup(bookId); } catch { /* Admin retry remains available. */ }
  }
  return { ok: true, name, path,
    previewPages: kind === "pdf" ? excerpt ? preview!.preview_pages : 0 : undefined,
    sourcePages: kind === "pdf" ? excerpt?.sourcePages || 0 : undefined };
}
