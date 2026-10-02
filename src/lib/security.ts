import type { User } from "@supabase/supabase-js";
export function isGmailUser(
  user: Pick<User, "email" | "email_confirmed_at"> | null,
): boolean {
  return !!(
    user?.email_confirmed_at &&
    user.email &&
    /^[^@\s]+@gmail\.com$/i.test(user.email)
  );
}
export function hasEmailOtpClaim(claims: {
  amr?: Array<string | { method?: string }>;
} | null): boolean {
  return !!claims?.amr?.some((entry) =>
    typeof entry === "string" ? entry === "otp" : entry.method === "otp",
  );
}
export function safeReturnTo(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  )
    return "/library";
  try {
    const u = new URL(value, "https://boishelf.invalid");
    return u.origin === "https://boishelf.invalid"
      ? u.pathname + u.search
      : "/library";
  } catch {
    return "/library";
  }
}
export function moneyToPaisa(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const match = String(value).match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const n = Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
  return Number.isSafeInteger(n) ? n : null;
}
export function isGatewayUrl(value: string, mode: "sandbox" | "live"): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.hostname ===
        (mode === "sandbox"
          ? "sandbox.sslcommerz.com"
          : "securepay.sslcommerz.com")
    );
  } catch {
    return false;
  }
}
