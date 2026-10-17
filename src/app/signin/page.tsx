import { SignIn } from "@/components/store";
import { hasSupabase } from "@/lib/config";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export const metadata = { title: "Sign in" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const p = await searchParams;
  if (await currentUser()) redirect("/");
  return <SignIn configured={hasSupabase()} error={p.error} />;
}
