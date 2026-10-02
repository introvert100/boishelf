import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { paymentMode } from "@/lib/config";
import { serviceClient } from "@/lib/supabase";
import { AppError, apiError, checkOrigin, rateLimit } from "@/lib/http";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookId: string; format: string }> },
) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    await rateLimit(`download:${user.id}`, 20, 60);
    const { bookId, format } = z
      .object({ bookId: z.uuid(), format: z.enum(["pdf", "epub"]) })
      .parse(await params);
    const db = serviceClient();
    const { data: access, error: a } = await db
      .from("entitlements")
      .select("id")
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .eq("mode", paymentMode())
      .is("revoked_at", null)
      .maybeSingle();
    if (a) throw a;
    if (!access)
      throw new AppError(403, "Purchase this book before downloading it.");
    const { data: file, error: f } = await db
      .from("book_formats")
      .select("storage_path,original_name")
      .eq("book_id", bookId)
      .eq("format", format)
      .maybeSingle();
    if (f) throw f;
    if (!file) throw new AppError(404, "This format is not available.");
    const { data, error } = await db.storage
      .from("ebooks")
      .createSignedUrl(file.storage_path, 60, { download: file.original_name });
    if (error) throw error;
    return Response.json(
      { url: data.signedUrl },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiError(e, "download_failed");
  }
}
