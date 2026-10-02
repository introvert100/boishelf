import { requireUser } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { AppError, apiError, checkOrigin, rateLimit } from "@/lib/http";
import { reconcileOrder } from "@/lib/payments";
import { z } from "zod";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const id = z.uuid().parse((await params).id);
    await rateLimit(`status:${user.id}`, 8, 60);
    const db = serviceClient();
    const { data: order, error } = await db
      .from("orders")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!order) throw new AppError(404, "Order not found.");
    await reconcileOrder(order);
    const { data, error: e } = await db
      .from("orders")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (e) throw e;
    return Response.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return apiError(e, "order_status_failed");
  }
}
