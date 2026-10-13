import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { AppError, apiError, checkOrigin, jsonBody, rateLimit } from "@/lib/http";

const input = z.object({ action: z.enum(["target","ship","deliver","collect","cancel","cancel_paid","return","refund"]),
  target: z.iso.date().optional(), courier: z.string().trim().max(100).optional(),
  tracking: z.string().trim().max(100).optional(), note: z.string().trim().max(500).optional() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const owner = await requireOwner();
    await rateLimit(`fulfillment:${owner.id}`, 30, 60);
    const id = z.uuid().parse((await params).id);
    const data = input.parse(await jsonBody(request));
    const { error } = await serviceClient().rpc("change_physical_order", {
      p_order: id, p_actor: owner.id, p_action: data.action,
      p_target: data.target || null, p_courier: data.courier || null,
      p_tracking: data.tracking || null, p_note: data.note || null,
    });
    if (error) {
      if (error.message.includes("invalid_transition"))
        throw new AppError(409, "This action is not allowed in the order's current state. Refresh and check its payment and delivery details.");
      if (error.message.includes("order_missing")) throw new AppError(404, "Order not found.");
      throw error;
    }
    return Response.json({ ok: true });
  } catch (error) { return apiError(error, "fulfillment_failed"); }
}
