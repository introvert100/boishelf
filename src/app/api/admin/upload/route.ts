import { requireOwner } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import {
  AppError,
  checkOrigin,
  rateLimit,
  boundedBody,
} from "@/lib/http";
import { detectUpload, uploadProblem } from "@/lib/admin-validation";
import { commitEbook, uploadFailure } from "@/lib/admin-upload";
import { z } from "zod";
export async function POST(request: Request) {
  const uploaded: { bucket: string; path: string }[] = [];
  let stage = "validation";
  let uploadKind = "unknown";
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
    uploadKind = kind;
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
    const ext = kind === "cover" ? mime.split("/")[1] : kind;
    const path = `${bookId}/${crypto.randomUUID()}.${ext}`;
    const bucket = kind === "cover" ? "covers" : "ebooks";
    stage = "storage_upload";
    const { error } = await db.storage
      .from(bucket)
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (error) throw error;
    uploaded.push({ bucket, path });
    const original =
      file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) ||
      `ebook.${kind}`;
    stage = "database_save";
    const result = kind === "cover" ? await (async () => {
      const { error: save } = await db.from("books").update({ cover_path: path }).eq("id", bookId);
      if (save) throw save;
      return { ok: true, name: original, path };
    })() : await commitEbook(db, { bookId, kind, path, bytes, name: original, size: file.size });
    uploaded.length = 0;
    return Response.json(result);
  } catch (e) {
    if (uploaded.length) {
      try {
        const db = serviceClient();
        for (const item of uploaded) await db.storage.from(item.bucket).remove([item.path]);
      } catch {
        /* Preserve the original error. */
      }
    }
    return uploadFailure(e, stage, uploadKind);
  }
}
