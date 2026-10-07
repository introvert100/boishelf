import { requireOwner } from "@/lib/auth";
import { commitEbook, readUploadTicket, uploadFailure } from "@/lib/admin-upload";
import { detectUpload } from "@/lib/admin-validation";
import { AppError, checkOrigin, jsonBody, rateLimit } from "@/lib/http";
import { PreviewPdfError } from "@/lib/preview-pdf";
import { serviceClient } from "@/lib/supabase";
import { savedPdfPageCount, savePdfPageCount } from "@/lib/book-pages";

export async function POST(request: Request) {
  let stage = "validation";
  let kind = "unknown";
  let pendingPath: string | null = null;
  try {
    checkOrigin(request);
    const owner = await requireOwner();
    await rateLimit(`upload-finish:${owner.id}`, 20, 60);
    const body = await jsonBody(request, 1800);
    const upload = readUploadTicket(body && typeof body === "object" ? (body as { ticket?: unknown }).ticket : undefined);
    kind = upload.kind;
    pendingPath = upload.path;
    const db = serviceClient();
    const { data: book, error: bookError } = await db.from("books")
      .select("id,archived_at").eq("id", upload.bookId).maybeSingle();
    if (bookError) throw bookError;
    if (!book) throw new AppError(404, "Book not found. Refresh the admin page.");
    if (book.archived_at) throw new AppError(409, "Restore this archived book before changing its files.");
    const { data: current, error: currentError } = await db.from("book_formats")
      .select("storage_path").eq("book_id", upload.bookId).eq("format", upload.kind).maybeSingle();
    if (currentError) throw currentError;
    if (current?.storage_path === upload.path) {
      const { data: preview, error: previewError } = upload.kind === "pdf"
        ? await db.from("book_previews").select("preview_pages").eq("book_id", upload.bookId).maybeSingle()
        : { data: null, error: null };
      if (previewError) throw previewError;
      const sourcePages = upload.kind === "pdf" ? await savedPdfPageCount(db, upload.bookId) : undefined;
      if (sourcePages) await savePdfPageCount(db, upload.bookId, sourcePages);
      return Response.json({ ok: true, name: upload.name, path: upload.path,
        previewPages: upload.kind === "pdf" ? preview?.preview_pages || 0 : undefined,
        sourcePages });
    }
    stage = "storage_read";
    const { data: file, error: downloadError } = await db.storage.from("ebooks").download(upload.path);
    if (downloadError || !file) throw downloadError || new AppError(409, "Upload is incomplete. Choose the file and retry.");
    if (file.size !== upload.size)
      throw new AppError(400, "Uploaded file size changed. Choose the file and retry.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (detectUpload(bytes, upload.kind) !== (upload.kind === "pdf" ? "application/pdf" : "application/epub+zip"))
      throw new AppError(400, `This file is not a valid ${upload.kind.toUpperCase()}. Choose the correct file and retry.`);
    stage = "database_save";
    const result = await commitEbook(db, {
      bookId: upload.bookId, kind: upload.kind, path: upload.path,
      bytes, name: upload.name, size: upload.size,
    });
    pendingPath = null;
    return Response.json(result);
  } catch (error) {
    if (pendingPath && (error instanceof PreviewPdfError || error instanceof AppError && error.status < 500)) {
      try { await serviceClient().storage.from("ebooks").remove([pendingPath]); }
      catch { /* Keep the original error. */ }
    }
    return uploadFailure(error, stage, kind);
  }
}
