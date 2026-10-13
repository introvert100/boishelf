import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { AppError, apiError, checkOrigin, rateLimit } from "@/lib/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    await rateLimit(`cancel-order:${user.id}`, 5, 60);
    const id = z.uuid().parse((await params).id);
    const db = serviceClient();
    const { data: order, error: lookup } = await db.from("orders")
      .select("id,order_kind,status").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (lookup) throw lookup;
    if (!order) throw new AppError(404, "Order not found.");
    if (order.order_kind !== "physical" || !["pending","rejected"].includes(order.status))
      throw new AppError(409, "This order needs owner help to cancel. Contact support.");
    const { error } = await db.rpc("change_physical_order", {
      p_order: id, p_actor: user.id, p_action: "cancel", p_target: null,
      p_courier: null, p_tracking: null, p_note: "Buyer cancelled before dispatch",
    });
    if (error) {
      if (error.message.includes("invalid_transition"))
        throw new AppError(409, "This order has changed. Refresh it before cancelling.");
      throw error;
    }
    return Response.json({ ok: true });
  } catch (error) { return apiError(error, "order_cancel_failed"); }
}
