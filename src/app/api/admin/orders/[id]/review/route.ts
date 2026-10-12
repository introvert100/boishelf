import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { AppError, apiError, checkOrigin, jsonBody, rateLimit } from "@/lib/http";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), claimId: z.uuid() }),
  z.object({ action: z.literal("reject"), claimId: z.uuid(), reason: z.string().trim().min(5).max(300) }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const owner = await requireOwner();
    await rateLimit(`review:${owner.id}`, 30, 60);
    const id = z.uuid().parse((await params).id);
    const input = schema.parse(await jsonBody(request));
    const { error } = input.action === "approve"
      ? await serviceClient().rpc("approve_manual_claim", { p_order: id, p_claim: input.claimId, p_owner: owner.id })
      : await serviceClient().rpc("reject_manual_claim", { p_order: id, p_claim: input.claimId, p_owner: owner.id, p_reason: input.reason });
    if (error) {
      if (/claim_not_pending|claim_missing|order_missing|already_owned/.test(error.message))
        throw new AppError(409, "This claim changed or was already resolved. Refresh the review queue.");
      throw error;
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "manual_review_failed");
  }
}
