import { requireUser } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { AppError, apiError, checkOrigin, rateLimit } from "@/lib/http";
import { z } from "zod";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const id = z.uuid().parse((await params).id);
    await rateLimit(`status:${user.id}`, 8, 60);
    const db = serviceClient();
    const { data: order, error } = await db.from("orders").select("*")
      .eq("id", id).eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!order) throw new AppError(404, "Order not found.");
    const { data: claim, error: ce } = await db.from("manual_payment_claims")
      .select("id,order_id,transaction_id,sender_last4,status,rejection_reason,submitted_at,decided_at")
      .eq("order_id", id).order("submitted_at", { ascending: false }).limit(1).maybeSingle();
    if (ce) throw ce;
    return Response.json({ order, claim }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "order_status_failed");
  }
}
