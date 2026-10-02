import "server-only";
import { paymentCredentials, appUrl } from "./config";
import { serviceClient } from "./supabase";
import { validatePayment, type GatewayResult } from "./payment-rules";
import { isGatewayUrl } from "./security";
import { AppError, logEvent } from "./http";
import type { Order, PaymentMode } from "./types";
const endpoint = (mode: PaymentMode) =>
  mode === "live"
    ? "https://securepay.sslcommerz.com"
    : "https://sandbox.sslcommerz.com";
async function gatewayFetch(url: URL | string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(18000),
  });
  if (!response.ok) throw new Error("Gateway unavailable");
  return response.json();
}
export async function initiatePayment(
  order: Order,
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
  },
) {
  const { id, password } = paymentCredentials(order.mode);
  const origin = appUrl();
  const body = new URLSearchParams({
    store_id: id,
    store_passwd: password,
    total_amount: (order.amount_paisa / 100).toFixed(2),
    currency: "BDT",
    tran_id: order.tran_id,
    success_url: `${origin}/api/payments/return?outcome=success`,
    fail_url: `${origin}/api/payments/return?outcome=failed`,
    cancel_url: `${origin}/api/payments/return?outcome=cancelled`,
    ipn_url: `${origin}/api/payments/ipn`,
    shipping_method: "NO",
    product_name: order.book_title.slice(0, 255),
    product_category: "Ebook",
    product_profile: "non-physical-goods",
    num_of_item: "1",
    cus_name: customer.name,
    cus_email: customer.email,
    cus_phone: customer.phone,
    cus_add1: customer.address,
    cus_city: customer.city,
    cus_country: "Bangladesh",
    cus_postcode: "",
    value_a: order.id,
  });
  const result = await gatewayFetch(
    `${endpoint(order.mode)}/gwprocess/v4/api.php`,
    { method: "POST", body },
  );
  if (
    result.status !== "SUCCESS" ||
    !result.GatewayPageURL ||
    !isGatewayUrl(result.GatewayPageURL, order.mode)
  )
    throw new AppError(
      502,
      "Payment provider is unavailable. Please try again.",
    );
  const { error } = await serviceClient()
    .from("payment_attempts")
    .update({
      session_key: result.sessionkey,
      gateway_url: result.GatewayPageURL,
    })
    .eq("order_id", order.id);
  if (error) throw error;
  return result.GatewayPageURL as string;
}
async function validatedResult(
  mode: PaymentMode,
  valId: string,
): Promise<GatewayResult> {
  const creds = paymentCredentials(mode);
  const url = new URL(
    `${endpoint(mode)}/validator/api/validationserverAPI.php`,
  );
  url.search = new URLSearchParams({
    val_id: valId,
    store_id: creds.id,
    store_passwd: creds.password,
    v: "1",
    format: "json",
  }).toString();
  return gatewayFetch(url);
}
async function applyResult(order: Order, result: GatewayResult) {
  const state = validatePayment(
    order,
    result,
    paymentCredentials(order.mode).id,
  );
  const { error } = await serviceClient().rpc("settle_order", {
    p_order: order.id,
    p_mode: order.mode,
    p_tran: result.tran_id,
    p_amount: order.amount_paisa,
    p_validation: result.val_id,
    p_bank: result.bank_tran_id,
    p_state: state,
  });
  if (error) throw error;
  if (state === "review")
    logEvent("payment_review_required", { orderId: order.id });
}
export async function reconcileOrder(order: Order) {
  if (order.status === "paid" || order.status === "refunded") return;
  const creds = paymentCredentials(order.mode);
  const url = new URL(
    `${endpoint(order.mode)}/validator/api/merchantTransIDvalidationAPI.php`,
  );
  url.search = new URLSearchParams({
    tran_id: order.tran_id,
    store_id: creds.id,
    store_passwd: creds.password,
    format: "json",
  }).toString();
  const result = await gatewayFetch(url);
  if (result.APIConnect !== "DONE" || !Array.isArray(result.element)) return;
  const rows = result.element.filter(
    (row: GatewayResult) => row.tran_id === order.tran_id,
  ) as GatewayResult[];
  const paid = rows.find(
    (r) => ["VALID", "VALIDATED"].includes(r.status || "") && r.val_id,
  );
  if (paid) {
    await applyResult(order, await validatedResult(order.mode, paid.val_id!));
    return;
  }
  const allTerminal =
    rows.length > 0 &&
    rows.every((r) =>
      ["FAILED", "CANCELLED", "CANCELED"].includes(r.status || ""),
    );
  if (allTerminal) {
    const state = rows.some((r) => r.status === "FAILED")
      ? "failed"
      : "cancelled";
    const { error } = await serviceClient().rpc("mark_order_unsuccessful", {
      p_order: order.id,
      p_state: state,
    });
    if (error) throw error;
    logEvent(`payment_${state}`, { orderId: order.id });
  }
}
export async function processNotification(values: Record<string, string>) {
  if (!values.tran_id || values.tran_id.length > 40)
    throw new AppError(400, "Invalid transaction reference.");
  const { data: order, error } = await serviceClient()
    .from("orders")
    .select("*")
    .eq("tran_id", values.tran_id)
    .maybeSingle();
  if (error) throw error;
  if (!order) throw new AppError(404, "Order not found.");
  if (values.val_id) {
    const result = await validatedResult(order.mode, values.val_id);
    await applyResult(order, result);
  } else await reconcileOrder(order);
  return order.id as string;
}
