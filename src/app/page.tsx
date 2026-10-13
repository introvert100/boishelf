import { Catalogue } from "@/components/store";
import { getBooks } from "@/lib/catalog";
import { getBundles } from "@/lib/bundles";
import { FeaturedBundles } from "@/components/commerce";
export default async function Home() {
  const books = await getBooks();
  const bundles = await getBundles(false, books);
  return <><Catalogue books={books} /><FeaturedBundles bundles={bundles} /></>;
}
