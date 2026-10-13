import "server-only";
import { hasSupabase } from "./config";
import { serviceClient } from "./supabase";
import { getBooks } from "./catalog";
import type { Book, Bundle } from "./types";

export async function getBundles(admin = false, suppliedBooks?: Book[]): Promise<Bundle[]> {
  if (!hasSupabase()) return [];
  const books = suppliedBooks || await getBooks(admin);
  let query = serviceClient().from("bundles")
    .select("id,slug,kind,title_bn,title_en,description_bn,description_en,price_paisa,published,archived_at,bundle_members(book_id,position)")
    .order("created_at", { ascending: false });
  if (!admin) query = query.eq("published", true).is("archived_at", null);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(({ bundle_members, ...bundle }) => {
    const members = (bundle_members as { book_id: string; position: number }[])
      .sort((a, b) => a.position - b.position)
      .map((m) => books.find((book) => book.id === m.book_id))
      .filter((book): book is Book => !!book);
    return { ...bundle, members, expectedMembers: bundle_members.length } as Bundle & { expectedMembers: number };
  }).filter((bundle) => admin || (bundle.members.length >= 2 && bundle.members.length === bundle.expectedMembers && bundle.members.every((book) =>
    bundle.kind === "ebook" ? book.formats.length > 0 : book.print_price_paisa != null)));
}

export async function getBundle(slug: string): Promise<Bundle | null> {
  return (await getBundles()).find((bundle) => bundle.slug === slug) || null;
}
