import { requireUser } from "@/lib/auth";
import { physicalReadiness, quotePhysicalCart } from "@/lib/commerce";
import { paymentSettings } from "@/lib/payment-settings";
import { physicalCheckoutInput } from "@/lib/commerce-validation";
import { serviceClient } from "@/lib/supabase";
import { AppError, apiError, checkOrigin, jsonBody, rateLimit } from "@/lib/http";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    await rateLimit(`physical-checkout:${user.id}`, 5, 60);
    const data = physicalCheckoutInput.parse(await jsonBody(request));
    // A retry returns the original snapshot even after its district is removed
    // or checkout is paused. It cannot place another order or reserve stock.
    const { data: existing, error: lookupError } = await serviceClient().from("orders")
      .select("id").eq("user_id", user.id).eq("client_key", data.clientKey).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return Response.json({ orderId: existing.id, reused: true },
      { headers: { "Cache-Control": "private, no-store" } });
    const available = await physicalReadiness();
    if (!available[data.method === "cod" ? "cod" : "bkash"])
      throw new AppError(503, "This payment option is not available yet.");
    const quote = await quotePhysicalCart(data.lines, data.district);
    if (quote.total_paisa !== data.expectedTotalPaisa)
      throw new AppError(409, "The cart total changed. Review the updated price before ordering.");
    const { data: order, error } = await serviceClient().rpc("create_physical_order", {
      p_user: user.id, p_key: data.clientKey, p_lines: data.lines,
      p_name: data.recipientName, p_phone: data.phone, p_district: data.district,
      p_area: data.localArea, p_street: data.streetAddress, p_method: data.method,
      p_number: data.method === "bkash_manual" ? (await paymentSettings()).receivingNumber : null,
      p_expected_total: data.expectedTotalPaisa,
    });
    if (error) {
      if (/out_of_stock|bundle_unavailable|book_unavailable/.test(error.message))
        throw new AppError(409, "An item sold out or became unavailable. Refresh your cart before retrying.");
      if (error.message.includes("price_changed"))
        throw new AppError(409, "The total changed. Refresh your cart before ordering.");
      if (error.message.includes("shipping_unconfigured"))
        throw new AppError(503, "Delivery fees are not configured yet.");
      if (error.message.includes("district_unavailable"))
        throw new AppError(409, "Delivery is no longer available in this district. Refresh and choose another district.");
      throw error;
    }
    return Response.json({ orderId: order.id, reused: !!order.reused },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error, "physical_checkout_failed"); }
}
