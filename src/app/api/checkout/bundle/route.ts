import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { bkashNumber } from "@/lib/config";
import { readiness } from "@/lib/readiness";
import { serviceClient } from "@/lib/supabase";
import { AppError, apiError, checkOrigin, jsonBody, rateLimit } from "@/lib/http";

const input = z.object({ bundleId: z.uuid(), accepted: z.literal(true) });
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    await rateLimit(`bundle-checkout:${user.id}`, 5, 60);
    const data = input.parse(await jsonBody(request));
    if (!(await readiness()).ready || !bkashNumber())
      throw new AppError(503, "bKash checkout is not available yet.");
    const { data: order, error } = await serviceClient().rpc("create_ebook_bundle_order", {
      p_user: user.id, p_bundle: data.bundleId, p_number: bkashNumber(),
    });
    if (error) {
      if (error.message.includes("already_owned"))
        throw new AppError(409, "You already own a book in this bundle. Open My Library before buying.");
      if (error.message.includes("bundle_unavailable"))
        throw new AppError(409, "This bundle is no longer available. Refresh the page.");
      throw error;
    }
    return Response.json({ orderId: order.id }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error, "bundle_checkout_failed"); }
}
