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
export function ownerEmail() {
  return (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
}
export function bkashNumber() {
  const number = (process.env.BKASH_RECEIVE_NUMBER || "").trim();
  return /^01[3-9]\d{8}$/.test(number) ? number : null;
}
export function manualCheckoutEnabled() {
  return process.env.MANUAL_BKASH_ENABLED === "true" &&
    process.env.BKASH_BUSINESS_ACCOUNT_CONFIRMED === "true";
}
