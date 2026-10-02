import { SignIn } from "@/components/store";
import { hasSupabase } from "@/lib/config";
import { safeReturnTo } from "@/lib/security";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export const metadata = { title: "Sign in" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const p = await searchParams;
  const next = safeReturnTo(p.next || null);
  if (await currentUser()) redirect(next);
  return <SignIn configured={hasSupabase()} returnTo={next} error={p.error} />;
}
