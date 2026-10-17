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
    return "/";
  try {
    const u = new URL(value, "https://boishelf.invalid");
    return u.origin === "https://boishelf.invalid"
      ? u.pathname + u.search
      : "/";
  } catch {
    return "/";
  }
}
