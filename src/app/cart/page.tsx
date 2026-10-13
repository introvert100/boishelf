import { getBooks } from "@/lib/catalog";
import { getBundles } from "@/lib/bundles";
import { viewer } from "@/lib/auth";
import { hasSupabase } from "@/lib/config";
import { physicalReadiness } from "@/lib/commerce";
import { PhysicalCart } from "@/components/commerce";
export const metadata = { title: "Printed-book cart" };
export default async function Page() {
  const books = await getBooks();
  const bundles = await getBundles(false, books);
  const ready = hasSupabase() ? await physicalReadiness() : { cod: false, bkash: false };
  return <PhysicalCart books={books} bundles={bundles} viewer={await viewer()} ready={ready} />;
}
