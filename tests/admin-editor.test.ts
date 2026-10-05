import test from "node:test";
import assert from "node:assert/strict";
import { bookInput, detectUpload, uploadProblem } from "../src/lib/admin-validation";
import { blankBook, bookValues, draftKey, parseBookDraft } from "../src/lib/book-draft";
import type { Book } from "../src/lib/types";

const valid = {
  slug: "my-book", title_bn: "আমার বই", title_en: "My Book",
  author_bn: "লেখক", author_en: "Author",
  description_bn: "এটি একটি বইয়ের সুন্দর বিবরণ।",
  description_en: "A useful description of this book.",
  category: "fiction", price_paisa: 1000, pages: 1, language: "bn",
  cover_style: "forest", published: false, is_demo: false, featured: false,
};

test("book validation identifies each invalid field with an actionable message", () => {
  const cases: { field: keyof typeof valid; value: unknown; message: RegExp }[] = [
    { field: "slug", value: "Bad Slug", message: /lowercase letters/ },
    { field: "slug", value: "a", message: /3–90/ },
    { field: "title_bn", value: "", message: /Bengali title/ },
    { field: "title_en", value: "", message: /English title/ },
    { field: "author_bn", value: "", message: /Bengali author/ },
    { field: "author_en", value: "", message: /English author/ },
    { field: "description_bn", value: "short", message: /10 characters/ },
    { field: "description_en", value: "short", message: /10 characters/ },
    { field: "price_paisa", value: 999, message: /10 BDT/ },
    { field: "price_paisa", value: 10000001, message: /100,000 BDT/ },
    { field: "price_paisa", value: 1000.5, message: /decimal places/ },
    { field: "pages", value: 0, message: /1 and 20,000/ },
    { field: "pages", value: 20001, message: /1 and 20,000/ },
    { field: "pages", value: 1.5, message: /whole number/ },
  ];
  for (const { field, value, message } of cases) {
    const result = bookInput.safeParse({ ...valid, [field]: value });
    assert.equal(result.success, false, `${field}: ${String(value)}`);
    if (!result.success) {
      assert.equal(result.error.issues[0].path[0], field);
      assert.match(result.error.issues[0].message, message);
    }
  }
  assert.equal(bookInput.safeParse(valid).success, true);
  assert.equal(bookInput.safeParse({ ...valid, price_paisa: 10000000 }).success, true);
});

test("browser draft round trip retains text, selections, and checkbox values", () => {
  const values = { ...blankBook, slug: "fresh-book", title_bn: "নতুন বই", description_en: "Work in progress", price: "49.50", pages: "212", category: "travel", language: "en", cover_style: "blue", is_demo: true, featured: true };
  assert.deepEqual(parseBookDraft(JSON.stringify({ version: 1, values })), values);
  assert.equal(parseBookDraft(JSON.stringify({ version: 1, values: { ...values, featured: "yes" } })), null);
  assert.equal(parseBookDraft("broken"), null);
  assert.notEqual(draftKey("owner-one"), draftKey("owner-two"));
});

test("editing an existing book starts with its saved values", () => {
  const book: Book = { ...valid, id: "book-1", price_paisa: 4950, pages: 212, cover_path: null, formats: [] };
  const values = bookValues(book);
  assert.equal(values.price, "49.5");
  assert.equal(values.pages, "212");
  assert.equal(values.slug, "my-book");
  assert.equal(values.published, false);
});

test("cover, PDF, and EPUB uploads explain size, filename, and content problems", () => {
  const mb = 1024 * 1024;
  for (const [kind, name, limit] of [["cover", "cover.png", 5], ["pdf", "book.pdf", 30], ["epub", "book.epub", 30]] as const) {
    assert.equal(uploadProblem(kind, name, 1), null);
    assert.equal(uploadProblem(kind, name, limit * mb), null);
    assert.match(uploadProblem(kind, name, limit * mb + 1)!, /MB/);
    assert.match(uploadProblem(kind, name, 0)!, /byte/);
    assert.notEqual(uploadProblem(kind, "wrong.txt", 1), null);
  }
  assert.equal(uploadProblem("cover", "cover.jpg", 5, "image/jpeg"), null);
  assert.match(uploadProblem("cover", "cover.jpg", 5, "image/png")!, /does not match/);
  assert.equal(detectUpload(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "cover"), "image/png");
  assert.equal(detectUpload(new TextEncoder().encode("%PDF-1.7\n"), "pdf"), "application/pdf");
  assert.equal(detectUpload(new TextEncoder().encode("PK\u0003\u0004mimetypeapplication/epub+zip"), "epub"), "application/epub+zip");
  assert.equal(detectUpload(new TextEncoder().encode("<html>not a book</html>"), "pdf"), null);
  assert.equal(detectUpload(new TextEncoder().encode("<html>not a book</html>"), "epub"), null);
  assert.equal(detectUpload(new TextEncoder().encode("<html>not a cover</html>"), "cover"), null);
});
