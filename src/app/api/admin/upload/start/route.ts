import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { issueUploadTicket, uploadFailure } from "@/lib/admin-upload";
import { uploadProblem } from "@/lib/admin-validation";
import { AppError, checkOrigin, jsonBody, rateLimit } from "@/lib/http";
import { serviceClient } from "@/lib/supabase";

const input = z.object({
  bookId: z.uuid(), kind: z.enum(["pdf", "epub"]), name: z.string().min(1).max(255),
  size: z.number().int().min(1).max(30 * 1024 * 1024),
});

export async function POST(request: Request) {
  let stage = "validation";
  let kind = "unknown";
  try {
    checkOrigin(request);
    const owner = await requireOwner();
    await rateLimit(`upload-start:${owner.id}`, 20, 60);
    const data = input.parse(await jsonBody(request));
    kind = data.kind;
    const problem = uploadProblem(data.kind, data.name, data.size);
    if (problem) throw new AppError(400, problem);
    const db = serviceClient();
    const { data: book, error: bookError } = await db.from("books")
      .select("id,archived_at").eq("id", data.bookId).maybeSingle();
    if (bookError) throw bookError;
    if (!book) throw new AppError(404, "Save the book before uploading files.");
    if (book.archived_at) throw new AppError(409, "Restore this archived book before changing its files.");
    const path = `${data.bookId}/${crypto.randomUUID()}.${data.kind}`;
    const name = data.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || `ebook.${data.kind}`;
    stage = "storage_upload";
    const { data: signed, error } = await db.storage.from("ebooks").createSignedUploadUrl(path);
    if (error || !signed?.token) throw error || new Error("Missing signed upload token");
    const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (origin.hostname.endsWith(".supabase.co"))
      origin.hostname = origin.hostname.replace(/\.supabase\.co$/, ".storage.supabase.co");
    return Response.json({
      ticket: issueUploadTicket({ bookId: data.bookId, kind: data.kind, path, name, size: data.size }),
      token: signed.token,
      endpoint: `${origin.origin}/storage/v1/upload/resumable`,
      path,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return uploadFailure(error, stage, kind); }
}
