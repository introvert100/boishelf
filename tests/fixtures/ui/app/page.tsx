import { Catalogue } from "@/components/store";
import { books } from "../data";
export default function Page() { return <Catalogue books={books.filter((book) => book.published)} />; }
