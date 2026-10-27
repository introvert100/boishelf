import { requireOwner } from "@/lib/auth";
import { checkoutControlsInput } from "@/lib/checkout-controls";
import { paymentSettings } from "@/lib/payment-settings";
import { serviceClient } from "@/lib/supabase";
import { AppError, apiError, checkOrigin, jsonBody, rateLimit } from "@/lib/http";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const owner = await requireOwner();
    await rateLimit(`checkout-settings:${owner.id}`, 10, 60);
    const data = checkoutControlsInput.parse(await jsonBody(request));
    if (data.bkashEnabled && !(await paymentSettings()).receivingNumber)
      throw new AppError(400, "Save your bKash receiving number first.");
    const { error } = await serviceClient().from("payment_settings").update({
      bkash_enabled: data.bkashEnabled, cod_enabled: data.codEnabled,
      business_confirmed: data.businessConfirmed, courier_confirmed: data.courierConfirmed,
      updated_by: owner.id, updated_at: new Date().toISOString(),
    }).eq("id", "default").select("id").single();
    if (error) throw error;
    return Response.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error, "checkout_settings_save_failed"); }
}
