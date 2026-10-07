import { requireOwner } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import {
  apiError,
  AppError,
  checkOrigin,
  rateLimit,
  boundedBody,
} from "@/lib/http";
import { detectUpload, uploadProblem } from "@/lib/admin-validation";
import { makePreviewPdf, PreviewPdfError } from "@/lib/preview-pdf";
import { queueStorageCleanup, runStorageCleanup } from "@/lib/storage-cleanup";
import { z } from "zod";
export async function POST(request: Request) {
  const uploaded: { bucket: string; path: string }[] = [];
  try {
    checkOrigin(request);
    const owner = await requireOwner();
    await rateLimit(`upload:${owner.id}`, 20, 60);
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.startsWith("multipart/form-data;"))
      throw new AppError(400, "Choose a file to upload.");
    const payload = await boundedBody(request, 31 * 1024 * 1024);
    const form = await new Response(payload, {
      headers: { "Content-Type": contentType },
    }).formData();
    const bookId = z.uuid().parse(form.get("bookId"));
    const kind = z.enum(["cover", "pdf", "epub"]).parse(form.get("kind"));
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError(400, "Choose a file to upload.");
    const fileProblem = uploadProblem(kind, file.name, file.size);
    if (fileProblem) throw new AppError(400, fileProblem);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = detectUpload(bytes, kind);
    if (!mime)
      throw new AppError(
        400,
        `This file is not a valid ${kind === "cover" ? "PNG, JPG, or WebP image" : kind.toUpperCase()}. Check the file and try again.`,
      );
    const formatProblem = uploadProblem(kind, file.name, file.size, mime);
    if (formatProblem) throw new AppError(400, formatProblem);
    const db = serviceClient();
    const { data: book, error: be } = await db
      .from("books")
      .select("id,archived_at")
      .eq("id", bookId)
      .single();
    if (be || !book)
      throw new AppError(404, "Save the book before uploading files.");
    if (book.archived_at) throw new AppError(409, "Restore this archived book before changing its files.");
    const { data: preview, error: previewError } = kind === "pdf"
      ? await db.from("book_previews").select("source_kind,preview_pages,preview_path,source_path")
          .eq("book_id", bookId).maybeSingle()
      : { data: null, error: null };
    if (previewError) throw previewError;
    const excerpt = kind === "pdf" && preview && preview.preview_pages > 0
      ? await makePreviewPdf(bytes, preview.preview_pages, true) : null;
    const ext = kind === "cover" ? mime.split("/")[1] : kind;
    const path = `${bookId}/${crypto.randomUUID()}.${ext}`;
    const bucket = kind === "cover" ? "covers" : "ebooks";
    const { error } = await db.storage
      .from(bucket)
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (error) throw error;
    uploaded.push({ bucket, path });
    const original =
      file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) ||
      `ebook.${kind}`;
    const excerptPath = excerpt ? `${bookId}/previews/${crypto.randomUUID()}.pdf` : null;
    if (excerptPath && excerpt) {
      const { error: excerptError } = await db.storage.from("ebooks")
        .upload(excerptPath, excerpt.bytes, { contentType: "application/pdf", upsert: false });
      if (excerptError) throw excerptError;
      uploaded.push({ bucket: "ebooks", path: excerptPath });
    }
    const { error: save } = excerpt && excerptPath
      ? await db.rpc("replace_pdf_with_preview", {
          p_book: bookId, p_path: path, p_name: original, p_size: file.size,
          p_preview_path: excerptPath, p_preview_pages: preview!.preview_pages,
          p_source_pages: excerpt.sourcePages, p_expected_path: preview!.preview_path,
        })
      : kind === "pdf" ? await db.rpc("replace_pdf_without_preview", {
          p_book: bookId, p_path: path, p_name: original, p_size: file.size,
          p_expected_path: preview?.preview_path || null,
        })
      :
      kind === "cover"
        ? await db.from("books").update({ cover_path: path }).eq("id", bookId)
        : await db
            .from("book_formats")
            .upsert(
              {
                book_id: bookId,
                format: kind,
                storage_path: path,
                original_name: original,
                size_bytes: file.size,
              },
              { onConflict: "book_id,format" },
            );
    if (save?.message.includes("preview_changed"))
      throw new AppError(409, "The preview changed in another tab. Refresh and retry this PDF upload.");
    if (save?.message.includes("book_archived"))
      throw new AppError(409, "Restore this archived book before changing its files.");
    if (save) throw save;
    uploaded.length = 0;
    if (excerptPath)
      await queueStorageCleanup(bookId, [
        { bucket: "ebooks", path: preview?.preview_path || null },
        { bucket: "ebooks", path: preview?.source_kind === "sample_pdf" ? preview.source_path : null },
      ]);
    else if (kind === "pdf") {
      try { await runStorageCleanup(bookId); } catch { /* A retry remains available in admin. */ }
    }
    return Response.json({ ok: true, name: original, path,
      previewPages: kind === "pdf" ? excerpt ? preview!.preview_pages : 0 : undefined,
      sourcePages: kind === "pdf" ? excerpt?.sourcePages || 0 : undefined });
  } catch (e) {
    if (uploaded.length) {
      try {
        const db = serviceClient();
        for (const item of uploaded) await db.storage.from(item.bucket).remove([item.path]);
      } catch {
        /* Preserve the original error. */
      }
    }
    return apiError(e instanceof PreviewPdfError ? new AppError(400, e.message) : e, "upload_failed");
  }
}
