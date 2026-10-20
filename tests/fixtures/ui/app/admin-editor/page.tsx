import { Admin } from "@/components/admin";
import { paymentSettings } from "@/lib/payment-settings";
import { books, fixtureUser, submittedClaim } from "../../data";

export default async function Page() {
  // Deliberately keep the original server snapshot to exercise edits made to
  // multiple books before the server's refreshed catalogue arrives.
  const setupBooks = books.slice(0, 2).map((book, index) => ({ ...book,
    title_en: index ? "Setup Second" : "Setup First", published: true,
    formats: [], print_price_paisa: null, print_on_hand: 0, print_reserved: 0 }));
  return <Admin books={setupBooks} bundles={[]} orders={[]} claims={[submittedClaim]} policies={[]}
    ownerId={fixtureUser.id} cleanupPending={0} physicalOrders={[]}
    shipping={{ dhaka_paisa: 6000, outside_paisa: 12000 }} gates={[]} physicalGates={[]}
    paymentSettings={await paymentSettings()} />;
}
