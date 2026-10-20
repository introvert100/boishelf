import { OrderView } from "@/components/store";
import { pendingOrder } from "../../data";

export default function Page() {
  return <OrderView initial={pendingOrder} initialClaim={null} />;
}
