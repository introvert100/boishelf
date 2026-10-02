import { NextResponse } from "next/server";
import { sessionClient } from "@/lib/supabase";
import { appUrl } from "@/lib/config";
import { safeReturnTo } from "@/lib/security";
export async function GET(request: Request) {
  const client = await sessionClient();
  const origin = appUrl();
  if (!client)
    return NextResponse.redirect(new URL("/signin?error=oauth", origin));
  const next = safeReturnTo(new URL(request.url).searchParams.get("next"));
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account", hd: "gmail.com" },
    },
  });
  return NextResponse.redirect(
    error || !data.url ? new URL("/signin?error=oauth", origin) : data.url,
  );
}
