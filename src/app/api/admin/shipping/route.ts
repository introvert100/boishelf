import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { apiError, checkOrigin, jsonBody, rateLimit } from "@/lib/http";

const input = z.object({ dhakaPaisa: z.number().int().min(0).max(1000000),
  outsidePaisa: z.number().int().min(0).max(1000000) });
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const owner = await requireOwner();
    await rateLimit(`shipping-settings:${owner.id}`, 10, 60);
    const data = input.parse(await jsonBody(request));
    const { error } = await serviceClient().from("shipping_settings")
      .update({ dhaka_paisa: data.dhakaPaisa, outside_paisa: data.outsidePaisa,
        updated_at: new Date().toISOString() }).eq("id", "default");
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) { return apiError(error, "shipping_settings_failed"); }
}
