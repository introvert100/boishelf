import "server-only";
import { hasSupabase } from "./config";
import { serviceClient } from "./supabase";
import { getBooks } from "./catalog";
import type { Book, Bundle } from "./types";
import { bundleIsAvailable } from "./bundle-selection";

export async function getBundles(admin = false, suppliedBooks?: Book[]): Promise<Bundle[]> {
  if (!hasSupabase()) return [];
  const books = suppliedBooks || await getBooks(admin);
  let query = serviceClient().from("bundles")
    .select("id,slug,kind,title_bn,title_en,description_bn,description_en,price_paisa,published,archived_at,bundle_members(book_id,position,format)")
    .order("created_at", { ascending: false });
  if (!admin) query = query.eq("published", true).is("archived_at", null);
  const { data, error } = await query;
  if (error) throw error;
  const withCounts = data.map(({ bundle_members, ...bundle }) => {
    const members = (bundle_members as { book_id: string; position: number; format: "ebook" | "physical" }[])
      .sort((a, b) => a.position - b.position)
      .flatMap((m) => {
        const book = books.find((book) => book.id === m.book_id);
        return book ? [{ ...book, bundle_format: m.format }] : [];
      });
    return { bundle: { ...bundle, members } as Bundle, expectedMembers: bundle_members.length };
  });
  return withCounts.filter(({ bundle, expectedMembers }) => admin || bundleIsAvailable(bundle, expectedMembers))
    .map(({ bundle }) => bundle);
}

export async function getBundle(slug: string): Promise<Bundle | null> {
  return (await getBundles()).find((bundle) => bundle.slug === slug) || null;
}
