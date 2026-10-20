import { requireOwner } from "@/lib/auth";
import { paymentSettings } from "@/lib/payment-settings";
import { paymentSettingsInput } from "@/lib/payment-validation";
import { serviceClient } from "@/lib/supabase";
import { apiError, checkOrigin, jsonBody, rateLimit } from "@/lib/http";

const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    await requireOwner();
    return Response.json(await paymentSettings(), { headers });
  } catch (error) { return apiError(error, "payment_settings_read_failed"); }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const owner = await requireOwner();
    await rateLimit(`payment-settings:${owner.id}`, 10, 60);
    const data = paymentSettingsInput.parse(await jsonBody(request));
    const { data: saved, error } = await serviceClient().from("payment_settings")
      .update({ receiving_number: data.receivingNumber, updated_by: owner.id,
        updated_at: new Date().toISOString() }).eq("id", "default")
      .select("receiving_number").single();
    if (error) throw error;
    return Response.json({ receivingNumber: saved.receiving_number, source: "admin" }, { headers });
  } catch (error) { return apiError(error, "payment_settings_save_failed"); }
}
