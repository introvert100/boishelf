import "server-only";
export function hasSupabase() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SECRET_KEY
  );
}
export function appUrl() {
  const value = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = new URL(value);
  if (
    process.env.NODE_ENV === "production" &&
    !["localhost", "127.0.0.1"].includes(url.hostname) &&
    url.protocol !== "https:"
  )
    throw new Error("HTTPS required");
  return url.origin;
}
export function paymentMode(): "sandbox" | "live" {
  const mode = process.env.PAYMENT_MODE || "sandbox";
  if (mode !== "sandbox" && mode !== "live")
    throw new Error("Invalid PAYMENT_MODE");
  return mode;
}
export function ownerEmail() {
  return (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
}
export function paymentCredentials(mode = paymentMode()) {
  const prefix = mode === "live" ? "SSLCOMMERZ_LIVE" : "SSLCOMMERZ_SANDBOX";
  const id = process.env[`${prefix}_STORE_ID`];
  const password = process.env[`${prefix}_STORE_PASSWORD`];
  if (!id || !password) throw new Error("Payment service is not configured");
  return { id, password };
}
