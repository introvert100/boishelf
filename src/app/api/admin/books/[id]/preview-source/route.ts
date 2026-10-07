import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { detectUpload, uploadProblem } from "@/lib/admin-validation";
import { apiError, AppError, boundedBody, checkOrigin, rateLimit } from "@/lib/http";
import { inspectPdf, makePreviewPdf, PreviewPdfError } from "@/lib/preview-pdf";
import { queueStorageCleanup } from "@/lib/storage-cleanup";
import { serviceClient } from "@/lib/supabase";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const uploaded: string[] = [];
  try {
    checkOrigin(request);
    const owner = await requireOwner();
    await rateLimit(`preview-source:${owner.id}`, 5, 60);
    const id = z.uuid().parse((await params).id);
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.startsWith("multipart/form-data;")) throw new AppError(400, "Choose a sample PDF.");
    const raw = await boundedBody(request, 31 * 1024 * 1024);
    const form = await new Response(raw, { headers: { "Content-Type": contentType } }).formData();
    const file = form.get("file");
    const pages = z.coerce.number().int().min(0).max(20000).parse(form.get("pages"));
    if (!(file instanceof File)) throw new AppError(400, "Choose a sample PDF.");
    const problem = uploadProblem("pdf", file.name, file.size);
    if (problem) throw new AppError(400, problem);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (detectUpload(bytes, "pdf") !== "application/pdf") throw new AppError(400, "This file is not a valid PDF.");
    const db = serviceClient();
    const { data: book, error: be } = await db.from("books").select("id,archived_at").eq("id", id).maybeSingle();
    if (be) throw be;
    if (!book) throw new AppError(404, "Save the book before uploading a sample PDF.");
    if (book.archived_at) throw new AppError(409, "Restore this archived book before changing its preview.");
    const { data: files, error: fe } = await db.from("book_formats")
      .select("format").eq("book_id", id);
    if (fe) throw fe;
    if (files.some((entry) => entry.format === "pdf"))
      throw new AppError(409, "This book already has a PDF ebook. Set its preview page count instead.");
    if (!files.some((entry) => entry.format === "epub"))
      throw new AppError(400, "Upload the EPUB ebook before adding a sample PDF.");
    const sourcePages = await inspectPdf(bytes);
    const excerpt = pages > 0 ? await makePreviewPdf(bytes, pages, false) : null;
    const { data: previous, error: pe } = await db.from("book_previews")
      .select("source_kind,source_path,preview_path").eq("book_id", id).maybeSingle();
    if (pe) throw pe;
    const sourcePath = `${id}/preview-sources/${crypto.randomUUID()}.pdf`;
    const { error: sourceError } = await db.storage.from("ebooks")
      .upload(sourcePath, bytes, { contentType: "application/pdf", upsert: false });
    if (sourceError) throw sourceError;
    uploaded.push(sourcePath);
    const previewPath = excerpt ? `${id}/previews/${crypto.randomUUID()}.pdf` : null;
    if (previewPath && excerpt) {
      const { error: previewError } = await db.storage.from("ebooks")
        .upload(previewPath, excerpt.bytes, { contentType: "application/pdf", upsert: false });
      if (previewError) throw previewError;
      uploaded.push(previewPath);
    }
    const { error: saveError } = await db.rpc("save_book_preview", {
      p_book: id, p_expected_path: previous?.preview_path || null,
      p_expected_source: previous?.source_path || null,
      p_source_kind: "sample_pdf", p_source_path: sourcePath,
      p_source_pages: sourcePages, p_preview_path: previewPath, p_preview_pages: pages,
    });
    if (saveError) throw saveError;
    uploaded.length = 0;
    await queueStorageCleanup(id, [
      { bucket: "ebooks", path: previous?.preview_path || null },
      { bucket: "ebooks", path: previous?.source_kind === "sample_pdf" ? previous.source_path : null },
    ]);
    return Response.json({ previewPages: pages, sourcePages, sourceKind: "sample_pdf", name: file.name });
  } catch (error) {
    if (uploaded.length) {
      try { await serviceClient().storage.from("ebooks").remove(uploaded); }
      catch { /* Preserve the original error. */ }
    }
    const message = error instanceof Error ? error.message : "";
    return apiError(error instanceof PreviewPdfError ? new AppError(400, error.message)
      : message.includes("preview_changed") || message.includes("preview_source_changed")
        ? new AppError(409, "The book or preview changed in another tab. Refresh and retry.")
        : message.includes("book_archived") ? new AppError(409, "Restore this archived book before changing its preview.")
          : error, "preview_source_failed");
  }
}
