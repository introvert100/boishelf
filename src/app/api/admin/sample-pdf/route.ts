import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { paymentMode } from "@/lib/config";
import { apiError, AppError, checkOrigin, jsonBody, rateLimit } from "@/lib/http";
import { samplePdf } from "@/lib/sample-pdf";
import { serviceClient } from "@/lib/supabase";

export async function POST(request: Request) {
  let uploaded: string | null = null;
  try {
    checkOrigin(request);
    const owner = await requireOwner();
    await rateLimit(`sample-pdf:${owner.id}`, 10, 60);
    if (paymentMode() !== "sandbox") throw new AppError(403, "Test files are available only in sandbox mode.");
    const { bookId } = z.object({ bookId: z.uuid() }).parse(await jsonBody(request));
    const db = serviceClient();
    const { data: book, error: lookup } = await db.from("books")
      .select("id,slug,title_en,is_demo,published,archived_at")
      .eq("id", bookId).maybeSingle();
    if (lookup) throw lookup;
    if (!book) throw new AppError(404, "Save the sample book before adding its test PDF.");
    if (book.archived_at) throw new AppError(409, "Restore this archived book before changing its test file.");
    if (!book.is_demo) throw new AppError(400, "Save this book as a sample before adding a test PDF.");
    if (book.published) throw new AppError(409, "Unpublish this book before changing its test file.");
    const { data: existing, error: fileLookup } = await db.from("book_formats")
      .select("id").eq("book_id", bookId).eq("format", "pdf").maybeSingle();
    if (fileLookup) throw fileLookup;
    if (existing) throw new AppError(409, "A PDF is already uploaded. Use the PDF upload control to replace it.");
    const bytes = samplePdf(book.title_en);
    const path = `${bookId}/${crypto.randomUUID()}.pdf`;
    const { error: uploadError } = await db.storage.from("ebooks")
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw uploadError;
    uploaded = path;
    const name = `${book.slug}-sample.pdf`;
    const { error: saveError } = await db.from("book_formats").insert({
      book_id: bookId, format: "pdf", storage_path: path,
      original_name: name, size_bytes: bytes.length,
    });
    if (saveError) throw saveError;
    uploaded = null;
    return Response.json({ ok: true, name });
  } catch (error) {
    if (uploaded) {
      try { await serviceClient().storage.from("ebooks").remove([uploaded]); }
      catch { /* Preserve the original failure. */ }
    }
    return apiError(error, "sample_pdf_failed");
  }
}
