import { shippingRates, physicalReadiness } from "@/lib/commerce";
import { readiness } from "@/lib/readiness";
import { Admin } from "@/components/admin";
import { paymentSettings } from "@/lib/payment-settings";
import { books, fixtureUser, submittedClaim } from "../../data";

export default async function Page({ searchParams }: { searchParams: Promise<{ ebooks?: string }> }) {
  // Deliberately keep the original server snapshot to exercise edits made to
  // multiple books before the server's refreshed catalogue arrives.
  const setupBooks = books.slice(0, 2).map((book, index) => ({ ...book,
    title_en: index ? "Setup Second" : "Setup First", published: true,
    formats: [], print_price_paisa: null, print_on_hand: 0, print_reserved: 0 }));
  const params = await searchParams;
  return <Admin books={params.ebooks ? books : setupBooks} bundles={[]} orders={[]} claims={[submittedClaim]} policies={[]}
    ownerId={fixtureUser.id} cleanupPending={0} physicalOrders={[]}
    shipping={await shippingRates()} gates={(await readiness()).gates} physicalGates={(await physicalReadiness()).gates}
    paymentSettings={await paymentSettings()} />;
}
