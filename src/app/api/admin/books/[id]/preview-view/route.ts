import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { apiError, AppError } from "@/lib/http";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireOwner();
    const id = z.uuid().parse((await params).id);
    const db = serviceClient();
    const { data: preview, error: pe } = await db.from("book_previews")
      .select("preview_path,preview_pages").eq("book_id", id).maybeSingle();
    if (pe) throw pe;
    if (!preview?.preview_path || !preview.preview_pages) throw new AppError(404, "Preview is not available.");
    const { data, error } = await db.storage.from("ebooks")
      .createSignedUrl(preview.preview_path, 300);
    if (error) throw error;
    return Response.json({ url: data.signedUrl, pages: preview.preview_pages },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error, "admin_preview_open_failed"); }
}
