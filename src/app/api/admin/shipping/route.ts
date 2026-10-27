import { deliverySettingsInput } from "@/lib/delivery-validation";
import { requireOwner } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { apiError, checkOrigin, jsonBody, rateLimit } from "@/lib/http";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const owner = await requireOwner();
    await rateLimit(`shipping-settings:${owner.id}`, 10, 60);
    const data = deliverySettingsInput.parse(await jsonBody(request));
    const { error } = await serviceClient().rpc("save_delivery_districts", {
      p_districts: data.districts, p_owner: owner.id,
    });
    if (error) throw error;
    return Response.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error, "shipping_settings_failed"); }
}
