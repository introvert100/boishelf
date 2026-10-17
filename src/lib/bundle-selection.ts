import type { Book, Bundle, EditionFormat } from "./types";

export function hasEdition(book: Book, format: EditionFormat) {
  return format === "ebook" ? book.formats.length > 0 : book.print_price_paisa != null;
}

export function bundleBookIssue(book: Book, kind: EditionFormat): "archived" | "sample" | "draft" | "ebook" | "physical" | null {
  if (book.archived_at) return "archived";
  if (book.is_demo) return "sample";
  if (!book.published) return "draft";
  return hasEdition(book, kind) ? null : kind;
}

export function bundleIsAvailable(bundle: Bundle, expectedMembers = bundle.members.length) {
  return bundle.kind !== "mixed" && bundle.members.length >= 2 && bundle.members.length === expectedMembers &&
    bundle.members.every((book) => !book.archived_at && book.published && !book.is_demo &&
      hasEdition(book, book.bundle_format) && book.bundle_format === bundle.kind);
}

export function printedBundleMembers(bundle: Bundle) {
  return bundle.members.filter((book) => book.bundle_format === "physical");
}
