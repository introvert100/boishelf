import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { AppError, apiError, checkOrigin, rateLimit } from "@/lib/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const owner = await requireOwner();
    await rateLimit(`bundle-archive:${owner.id}`, 10, 60);
    const id = z.uuid().parse((await params).id);
    const { data, error } = await serviceClient().from("bundles")
      .update({ published: false, archived_at: new Date().toISOString() })
      .eq("id", id).is("archived_at", null).select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new AppError(404, "Bundle not found or already archived.");
    return Response.json({ ok: true });
  } catch (error) { return apiError(error, "bundle_archive_failed"); }
}
