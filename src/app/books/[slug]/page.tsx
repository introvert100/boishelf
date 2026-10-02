import { notFound } from "next/navigation";
import { getBook } from "@/lib/catalog";
import { BookDetail } from "@/components/store";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const b = await getBook((await params).slug);
  return { title: b?.title_en || "Book not found" };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const book = await getBook((await params).slug);
  if (!book) notFound();
  return <BookDetail book={book} />;
}
