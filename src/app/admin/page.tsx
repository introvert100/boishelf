import { currentUser, isOwner } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { getBooks } from "@/lib/catalog";
import { getBundles } from "@/lib/bundles";
import { shippingRates, physicalReadiness } from "@/lib/commerce";
import { readiness } from "@/lib/readiness";
import { paymentSettings } from "@/lib/payment-settings";
import { redirect, notFound } from "next/navigation";
import { Admin } from "@/components/admin";
import type { ReviewClaim } from "@/lib/types";
export const metadata = {
  title: "Store admin",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/admin");
  if (!isOwner(user.email)) notFound();
  const db = serviceClient();
  const [
    books,
    state,
    { data: orders, error: o },
    { data: policies, error: p },
    { count: cleanupPending, error: c },
    { data: rawClaims, error: claimError },
    { data: physicalOrders, error: physicalError },
    shipping,
    physicalState,
    payments,
  ] = await Promise.all([
    getBooks(true),
    readiness(),
    db
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    db.from("policies").select("*"),
    db.from("storage_cleanup_jobs").select("id", { count: "exact", head: true }).is("done_at", null),
    db.from("manual_payment_claims").select("*").eq("status", "submitted")
      .order("submitted_at", { ascending: true }).limit(100),
    db.from("orders").select("*,order_shipping(*),order_items(id,item_type,title_bn,title_en,format,quantity,unit_price_paisa,order_item_members(book_id,title_bn,title_en,format))")
      .eq("order_kind", "physical").order("created_at", { ascending: false }).limit(100),
    shippingRates(),
    physicalReadiness(),
    paymentSettings(),
  ]);
  if (o || p || c || claimError || physicalError) throw o || p || c || claimError || physicalError;
  let claims: ReviewClaim[] = [];
  if (rawClaims?.length) {
    const { data: claimOrders, error: orderError } = await db.from("orders").select("*")
      .in("id", rawClaims.map((claim) => claim.order_id));
    if (orderError) throw orderError;
    const { data: profiles, error: profileError } = await db.from("profiles").select("id,email")
      .in("id", [...new Set((claimOrders || []).map((order) => order.user_id))]);
    if (profileError) throw profileError;
    claims = rawClaims.flatMap((claim) => {
      const order = claimOrders?.find((item) => item.id === claim.order_id);
      return order ? [{ ...claim, order, customerEmail: profiles?.find((profile) => profile.id === order.user_id)?.email || "" }] : [];
    }) as ReviewClaim[];
  }
  return (
    <Admin
      books={books}
      orders={orders!}
      claims={claims}
      policies={policies!}
      gates={state.gates}
      ownerId={user.id}
      cleanupPending={cleanupPending || 0}
      bundles={await getBundles(true, books)}
      physicalOrders={physicalOrders || []}
      shipping={shipping}
      physicalGates={physicalState.gates}
      paymentSettings={payments}
    />
  );
}
