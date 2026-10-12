import { currentUser, isOwner } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { getBooks } from "@/lib/catalog";
import { readiness } from "@/lib/readiness";
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
  ]);
  if (o || p || c || claimError) throw o || p || c || claimError;
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
    />
  );
}
