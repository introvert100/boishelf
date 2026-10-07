import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { apiError, AppError, checkOrigin, rateLimit } from "@/lib/http";
import { serviceClient } from "@/lib/supabase";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const owner = await requireOwner();
    await rateLimit(`book-restore:${owner.id}`, 10, 60);
    const id = z.uuid().parse((await params).id);
    const { data, error } = await serviceClient().from("books")
      .update({ archived_at: null, published: false })
      .eq("id", id).not("archived_at", "is", null).select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new AppError(404, "Archived book not found. Refresh the admin page.");
    return Response.json({ action: "restored" });
  } catch (error) { return apiError(error, "book_restore_failed"); }
}
