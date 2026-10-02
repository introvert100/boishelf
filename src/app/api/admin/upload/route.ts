import { requireOwner } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import {
  apiError,
  AppError,
  checkOrigin,
  rateLimit,
  boundedBody,
} from "@/lib/http";
import { detectUpload } from "@/lib/admin-validation";
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
    if (
      !(file instanceof File) ||
      !file.size ||
      file.size > (kind === "cover" ? 5 : 30) * 1024 * 1024
    )
      throw new AppError(
        400,
        "Choose a file under 5 MB for covers or 30 MB for ebooks.",
      );
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = detectUpload(bytes, kind);
    if (!mime)
      throw new AppError(
        400,
        "The file content does not match the selected format.",
      );
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
    return Response.json({ ok: true });
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
