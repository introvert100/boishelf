import { Catalogue } from "@/components/store";
import { getBooks } from "@/lib/catalog";
export default async function Home() {
  return <Catalogue books={await getBooks()} />;
}
