import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { apiError, AppError, checkOrigin, jsonBody, rateLimit } from "@/lib/http";
import { makePreviewPdf, PreviewPdfError } from "@/lib/preview-pdf";
import { queueStorageCleanup } from "@/lib/storage-cleanup";
import { serviceClient } from "@/lib/supabase";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let uploaded: string | null = null;
  try {
    checkOrigin(request);
    const owner = await requireOwner();
    await rateLimit(`preview:${owner.id}`, 8, 60);
    const id = z.uuid().parse((await params).id);
    const { pages } = z.object({ pages: z.number().int().min(0).max(20000) }).parse(await jsonBody(request));
    const db = serviceClient();
    const { data: book, error: be } = await db.from("books").select("id,archived_at").eq("id", id).maybeSingle();
    if (be) throw be;
    if (!book) throw new AppError(404, "Book not found. Refresh the admin page.");
    if (book.archived_at) throw new AppError(409, "Restore this archived book before changing its preview.");
    const { data: previous, error: pe } = await db.from("book_previews")
      .select("source_kind,source_path,preview_path,preview_pages,source_page_count")
      .eq("book_id", id).maybeSingle();
    if (pe) throw pe;
    if (pages === 0) {
      if (previous) {
        const { error } = await db.rpc("save_book_preview", {
          p_book: id, p_expected_path: previous.preview_path,
          p_expected_source: previous.source_path, p_source_kind: previous.source_kind,
          p_source_path: previous.source_path, p_source_pages: previous.source_page_count,
          p_preview_path: null, p_preview_pages: 0,
        });
        if (error) throw error;
        await queueStorageCleanup(id, [{ bucket: "ebooks", path: previous.preview_path }]);
      }
      return Response.json({ previewPages: 0, sourcePages: previous?.source_page_count || 0, sourceKind: previous?.source_kind || null });
    }
    const { data: pdf, error: fe } = await db.from("book_formats")
      .select("storage_path").eq("book_id", id).eq("format", "pdf").maybeSingle();
    if (fe) throw fe;
    const sourceKind = pdf ? "book_pdf" : previous?.source_kind === "sample_pdf" ? "sample_pdf" : null;
    const sourcePath = pdf?.storage_path || (sourceKind === "sample_pdf" ? previous?.source_path : null);
    if (!sourcePath || !sourceKind)
      throw new AppError(400, "Upload a PDF ebook or a separate sample PDF before enabling previews.");
    const { data: source, error: downloadError } = await db.storage.from("ebooks").download(sourcePath);
    if (downloadError || !source) throw downloadError || new AppError(503, "Could not read the preview source PDF.");
    const { bytes, sourcePages } = await makePreviewPdf(new Uint8Array(await source.arrayBuffer()), pages, sourceKind === "book_pdf");
    const path = `${id}/previews/${crypto.randomUUID()}.pdf`;
    const { error: uploadError } = await db.storage.from("ebooks")
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw uploadError;
    uploaded = path;
    const { error: saveError } = await db.rpc("save_book_preview", {
      p_book: id, p_expected_path: previous?.preview_path || null,
      p_expected_source: previous?.source_path || null,
      p_source_kind: sourceKind, p_source_path: sourcePath,
      p_source_pages: sourcePages, p_preview_path: path, p_preview_pages: pages,
    });
    if (saveError) throw saveError;
    uploaded = null;
    await queueStorageCleanup(id, [
      { bucket: "ebooks", path: previous?.preview_path || null },
      { bucket: "ebooks", path: previous?.source_kind === "sample_pdf" && sourceKind === "book_pdf" ? previous.source_path : null },
    ]);
    return Response.json({ previewPages: pages, sourcePages, sourceKind });
  } catch (error) {
    if (uploaded) {
      try { await serviceClient().storage.from("ebooks").remove([uploaded]); }
      catch { /* Keep the original error. */ }
    }
    const message = error instanceof Error ? error.message : "";
    return apiError(error instanceof PreviewPdfError ? new AppError(400, error.message)
      : message.includes("preview_changed") || message.includes("preview_source_changed")
        ? new AppError(409, "The preview or PDF changed in another tab. Refresh and retry.")
        : message.includes("book_archived") ? new AppError(409, "Restore this archived book before changing its preview.")
          : error, "preview_save_failed");
  }
}
