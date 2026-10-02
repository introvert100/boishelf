import { hasSupabase } from "@/lib/config";
import { serviceClient } from "@/lib/supabase";
import { policySlugs } from "@/lib/types";
import { PolicyView } from "@/components/store";
import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!policySlugs.some((s) => s === slug)) notFound();
  let policy = null;
  if (hasSupabase()) {
    const { data, error } = await serviceClient()
      .from("policies")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle();
    if (error) throw error;
    policy = data;
  }
  return <PolicyView policy={policy} slug={slug} />;
}
