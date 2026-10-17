import type { Book, Bundle, BundleKind, EditionFormat } from "./types";

export function hasEdition(book: Book, format: EditionFormat) {
  return format === "ebook" ? book.formats.length > 0 : book.print_price_paisa != null;
}

export function bundleBookIssue(book: Book, kind: BundleKind): "archived" | "sample" | "draft" | "ebook" | "physical" | "edition" | null {
  if (book.archived_at) return "archived";
  if (book.is_demo) return "sample";
  if (!book.published) return "draft";
  if (kind === "mixed") return hasEdition(book, "ebook") || hasEdition(book, "physical") ? null : "edition";
  return hasEdition(book, kind) ? null : kind;
}

export function bundleIsAvailable(bundle: Bundle, expectedMembers = bundle.members.length) {
  return bundle.members.length >= 2 && bundle.members.length === expectedMembers &&
    bundle.members.every((book) => !book.archived_at && book.published && !book.is_demo &&
      hasEdition(book, book.bundle_format) && (bundle.kind === "mixed" || book.bundle_format === bundle.kind)) &&
    (bundle.kind !== "mixed" || new Set(bundle.members.map((book) => book.bundle_format)).size === 2);
}

export function printedBundleMembers(bundle: Bundle) {
  return bundle.members.filter((book) => book.bundle_format === "physical");
}
