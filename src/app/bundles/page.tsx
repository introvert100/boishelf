import { getBooks } from "@/lib/catalog";
import { getBundles } from "@/lib/bundles";
import { BundleList } from "@/components/commerce";
export const metadata = { title: "Book bundles" };
export default async function Page() {
  const books = await getBooks();
  return <BundleList bundles={await getBundles(false, books)} />;
}
