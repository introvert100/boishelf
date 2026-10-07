import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { savedPdfPageCount, savePdfPageCount } from "@/lib/book-pages";
import { AppError, apiError, checkOrigin, rateLimit } from "@/lib/http";
import { PreviewPdfError } from "@/lib/preview-pdf";
import { serviceClient } from "@/lib/supabase";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const owner = await requireOwner();
    await rateLimit(`pdf-pages:${owner.id}`, 8, 60);
    const id = z.uuid().parse((await params).id);
    const db = serviceClient();
    const { data: book, error } = await db.from("books")
      .select("pages,archived_at").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!book) throw new AppError(404, "Book not found. Refresh the admin page.");
    if (book.archived_at) throw new AppError(409, "Restore this archived book before changing its details.");
    const pages = await savedPdfPageCount(db, id);
    if (pages !== book.pages) await savePdfPageCount(db, id, pages);
    return Response.json({ pages }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error instanceof PreviewPdfError ? new AppError(400, error.message) : error, "pdf_pages_detect_failed");
  }
}
