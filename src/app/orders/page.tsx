import { currentUser } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { MyOrders } from "@/components/commerce";
export const metadata = { title: "My orders" };
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/orders");
  const { data, error } = await serviceClient().from("orders").select("*")
    .eq("user_id", user.id).eq("mode", "live")
    .order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return <MyOrders orders={data} />;
}
