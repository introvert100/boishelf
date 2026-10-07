import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { apiError, AppError } from "@/lib/http";
import { inspectPdf, PreviewPdfError } from "@/lib/preview-pdf";
import { serviceClient } from "@/lib/supabase";
import { ebookLimitBytes } from "@/lib/upload-limits";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireOwner();
    const id = z.uuid().parse((await params).id);
    const kind = z.enum(["pdf", "epub", "sample"]).parse(new URL(request.url).searchParams.get("kind"));
    const db = serviceClient();
    let path: string | null = null;
    let savedPages = 0;
    if (kind === "sample") {
      const { data, error } = await db.from("book_previews")
        .select("source_kind,source_path,source_page_count").eq("book_id", id).maybeSingle();
      if (error) throw error;
      if (data?.source_kind === "sample_pdf") {
        path = data.source_path;
        savedPages = data.source_page_count;
      }
    } else {
      const { data, error } = await db.from("book_formats")
        .select("storage_path").eq("book_id", id).eq("format", kind).maybeSingle();
      if (error) throw error;
      path = data?.storage_path || null;
    }
    if (!path) throw new AppError(404, "This source file is no longer available. Refresh the admin page.");
    const { data: file, error: downloadError } = await db.storage.from("ebooks").download(path);
    if (downloadError || !file) throw downloadError || new AppError(503, "Could not open the source file.");
    if (kind === "epub") {
      if (file.size > ebookLimitBytes) throw new AppError(413, "The EPUB is too large to inspect in the browser.");
      return new Response(file, { headers: {
        "Content-Type": "application/epub+zip",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      } });
    }
    const pages = savedPages || await inspectPdf(new Uint8Array(await file.arrayBuffer()));
    const { data, error } = await db.storage.from("ebooks").createSignedUrl(path, 300);
    if (error) throw error;
    return Response.json({ url: data.signedUrl, pages, maxPreviewPages: kind === "pdf" ? pages - 1 : pages },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error instanceof PreviewPdfError ? new AppError(400, error.message) : error, "admin_source_view_failed");
  }
}
