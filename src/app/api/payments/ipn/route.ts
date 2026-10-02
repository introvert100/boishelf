import { processNotification } from "@/lib/payments";
import { boundedBody, apiError } from "@/lib/http";
export async function POST(request: Request) {
  try {
    const text = new TextDecoder().decode(await boundedBody(request, 20000));
    await processNotification(Object.fromEntries(new URLSearchParams(text)));
    return Response.json({ received: true });
  } catch (e) {
    return apiError(e, "payment_callback_failed");
  }
}
