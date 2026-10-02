import { NextResponse } from "next/server";
import { sessionClient } from "@/lib/supabase";
import { appUrl } from "@/lib/config";
import { isGmailUser, safeReturnTo } from "@/lib/security";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const client = await sessionClient();
  const origin = appUrl();
  const code = url.searchParams.get("code");
  if (client && code) {
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (!error && isGmailUser(data.user))
      return NextResponse.redirect(
        new URL(safeReturnTo(url.searchParams.get("next")), origin),
      );
    await client.auth.signOut();
    return NextResponse.redirect(new URL("/signin?error=gmail", origin));
  }
  return NextResponse.redirect(new URL("/signin?error=oauth", origin));
}
