import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { apiError, AppError, checkOrigin, rateLimit } from "@/lib/http";
import { runStorageCleanup } from "@/lib/storage-cleanup";
import { serviceClient } from "@/lib/supabase";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const owner = await requireOwner();
    await rateLimit(`book-delete:${owner.id}`, 10, 60);
    const id = z.uuid().parse((await params).id);
    const db = serviceClient();
    const { error } = await db.rpc("delete_unsold_book", { p_book: id });
    if (error?.message.includes("book_has_orders")) {
      const { data, error: archiveError } = await db.from("books")
        .update({ archived_at: new Date().toISOString(), published: false })
        .eq("id", id).select("id").maybeSingle();
      if (archiveError) throw archiveError;
      if (!data) throw new AppError(404, "Book not found. Refresh the admin page.");
      return Response.json({ action: "archived" });
    }
    if (error?.message.includes("book_not_found")) throw new AppError(404, "Book not found. Refresh the admin page.");
    if (error) throw error;
    let cleanupPending = false;
    try { cleanupPending = (await runStorageCleanup(id)).remaining > 0; }
    catch { cleanupPending = true; }
    return Response.json({ action: "deleted", cleanupPending });
  } catch (error) { return apiError(error, "book_delete_failed"); }
}
