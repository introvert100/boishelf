import { currentUser, isOwner } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { getBooks } from "@/lib/catalog";
import { readiness } from "@/lib/readiness";
import { redirect, notFound } from "next/navigation";
import { Admin } from "@/components/admin";
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
  ] = await Promise.all([
    getBooks(true),
    readiness(true),
    db
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    db.from("policies").select("*"),
  ]);
  if (o || p) throw o || p;
  return (
    <Admin
      books={books}
      orders={orders!}
      policies={policies!}
      gates={state.gates}
      mode={state.mode}
    />
  );
}
