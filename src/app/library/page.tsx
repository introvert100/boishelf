import { currentUser } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { paymentMode } from "@/lib/config";
import { LibraryView } from "@/components/store";
import { redirect } from "next/navigation";
import type { Book } from "@/lib/types";
export const metadata = { title: "My library" };
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/library");
  const db = serviceClient();
  const [{ data: access, error: a }, { data: orders, error: o }] =
    await Promise.all([
      db
        .from("entitlements")
        .select("book_id")
        .eq("user_id", user.id)
        .eq("mode", paymentMode())
        .is("revoked_at", null),
      db
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .eq("mode", paymentMode())
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
  if (a || o) throw a || o;
  let books: Book[] = [];
  if (access.length) {
    const { data, error } = await db
      .from("books")
      .select("*,book_formats(format)")
      .in(
        "id",
        access.map((x) => x.book_id),
      );
    if (error) throw error;
    books = data.map(({ book_formats, ...b }) => ({
      ...b,
      formats: book_formats.map((f: { format: string }) =>
        f.format.toUpperCase(),
      ),
    })) as Book[];
  }
  return (
    <LibraryView
      books={books}
      orders={orders}
      sandbox={paymentMode() === "sandbox"}
    />
  );
}
