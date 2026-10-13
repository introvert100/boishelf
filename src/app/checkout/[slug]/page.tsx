import { notFound } from "next/navigation";
import { getBook } from "@/lib/catalog";
import { viewer } from "@/lib/auth";
import { readiness } from "@/lib/readiness";
import { Checkout } from "@/components/store";
export const metadata = { title: "Checkout" };
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const book = await getBook((await params).slug);
  if (!book || !book.formats.length) notFound();
  const v = await viewer();
  const state = await readiness();
  return (
    <Checkout
      book={book}
      viewer={v}
      ready={state.ready}
    />
  );
}
