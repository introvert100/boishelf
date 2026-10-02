import { serviceClient } from "@/lib/supabase";
import { currentUser, isOwner } from "@/lib/auth";
import { paymentMode } from "@/lib/config";
import { z } from "zod";
import { AppError, apiError } from "@/lib/http";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = z.uuid().parse((await params).id);
    const db = serviceClient();
    const { data: book, error } = await db
      .from("books")
      .select("cover_path,published")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!book?.cover_path) throw new AppError(404, "Cover not found.");
    if (!book.published) {
      const user = await currentUser();
      if (!user) throw new AppError(404, "Cover not found.");
      if (!isOwner(user.email)) {
        const { data: access } = await db
          .from("entitlements")
          .select("id")
          .eq("book_id", id)
          .eq("user_id", user.id)
          .eq("mode", paymentMode())
          .is("revoked_at", null)
          .maybeSingle();
        if (!access) throw new AppError(404, "Cover not found.");
      }
    }
    const { data, error: e } = await db.storage
      .from("covers")
      .createSignedUrl(book.cover_path, 300);
    if (e) throw e;
    return new Response(null, {
      status: 307,
      headers: {
        Location: data.signedUrl,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return apiError(e, "cover_failed");
  }
}
