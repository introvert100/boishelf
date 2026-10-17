import { currentUser } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { notFound, redirect } from "next/navigation";
import { OrderView } from "@/components/store";
import { PhysicalOrderView } from "@/components/commerce";
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
  if (data.order_kind === "physical") {
    const [{ data: shipping, error: shippingError }, { data: lines, error: linesError },
      { data: latestClaim, error: claimError }] = await Promise.all([
      serviceClient().from("order_shipping").select("*").eq("order_id", id).single(),
      serviceClient().from("order_items")
        .select("id,item_type,title_bn,title_en,format,quantity,unit_price_paisa,order_item_members(book_id,title_bn,title_en,format)")
        .eq("order_id", id),
      serviceClient().from("manual_payment_claims")
        .select("status,rejection_reason").eq("order_id", id)
        .order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (shippingError || linesError || claimError) throw shippingError || linesError || claimError;
    return <PhysicalOrderView order={data} shipping={shipping} lines={lines || []}
      rejectionReason={latestClaim?.status === "rejected" ? latestClaim.rejection_reason : null} />;
  }
  const { data: claim, error: claimError } = await serviceClient()
    .from("manual_payment_claims")
    .select("id,order_id,transaction_id,sender_last4,status,rejection_reason,submitted_at,decided_at")
    .eq("order_id", id).order("submitted_at", { ascending: false }).limit(1).maybeSingle();
  if (claimError) throw claimError;
  let bundleSnapshot: { title_bn: string; title_en: string; members: { title_bn: string; title_en: string }[] } | null = null;
  if (data.order_kind === "ebook_bundle") {
    const { data: items, error: itemError } = await serviceClient().from("order_items")
      .select("title_bn,title_en,order_item_members(title_bn,title_en)")
      .eq("order_id", id).limit(1);
    if (itemError) throw itemError;
    const item = items?.[0];
    if (item) bundleSnapshot = {
      title_bn: item.title_bn, title_en: item.title_en,
      members: item.order_item_members || [],
    };
  }
  return <OrderView initial={data} initialClaim={claim} bundleSnapshot={bundleSnapshot} />;
}
