import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { AppError, apiError, checkOrigin, jsonBody, rateLimit } from "@/lib/http";

const schema = z.object({
  transactionId: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6,30}$/, "Enter the bKash transaction ID (6–30 letters or numbers)."),
  senderLast4: z.string().regex(/^\d{4}$/, "Enter the last four digits of the sending bKash number."),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const id = z.uuid().parse((await params).id);
    await rateLimit(`claim:${user.id}`, 5, 300);
    const input = schema.parse(await jsonBody(request));
    const { error } = await serviceClient().rpc("submit_manual_claim", {
      p_user: user.id, p_order: id,
      p_transaction: input.transactionId, p_last4: input.senderLast4,
    });
    if (error) {
      if (error.code === "23505" || error.message.includes("transaction_reused")) throw new AppError(409, "This transaction ID belongs to another order or is already under review. Check it or contact support.");
      if (error.message.includes("order_missing")) throw new AppError(404, "Order not found.");
      if (error.message.includes("claim_not_allowed")) throw new AppError(409, "This order cannot accept a payment claim now. Refresh its status.");
      throw error;
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "manual_claim_failed");
  }
}
