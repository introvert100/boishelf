import { currentUser } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { notFound, redirect } from "next/navigation";
import { OrderView } from "@/components/store";
import { z } from "zod";
export const metadata = { title: "Order status" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await currentUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(`/orders/${id}`)}`);
  const { data, error } = await serviceClient()
    .from("orders")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) notFound();
  return <OrderView initial={data} />;
}
