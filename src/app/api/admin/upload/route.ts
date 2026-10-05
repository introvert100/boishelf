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
import { z } from "zod";
export async function POST(request: Request) {
  let uploaded: { bucket: string; path: string } | null = null;
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
      .select("id")
      .eq("id", bookId)
      .single();
    if (be || !book)
      throw new AppError(404, "Save the book before uploading files.");
    const ext = kind === "cover" ? mime.split("/")[1] : kind;
    const path = `${bookId}/${crypto.randomUUID()}.${ext}`;
    const bucket = kind === "cover" ? "covers" : "ebooks";
    const { error } = await db.storage
      .from(bucket)
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (error) throw error;
    uploaded = { bucket, path };
    const original =
      file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) ||
      `ebook.${kind}`;
    const { error: save } =
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
    if (save) throw save;
    uploaded = null;
    return Response.json({ ok: true, name: original });
  } catch (e) {
    if (uploaded) {
      try {
        await serviceClient()
          .storage.from(uploaded.bucket)
          .remove([uploaded.path]);
      } catch {
        /* Preserve the original error. */
      }
    }
    return apiError(e, "upload_failed");
  }
}
