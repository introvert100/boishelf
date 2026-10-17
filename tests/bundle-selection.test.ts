import { test } from "node:test";
import assert from "node:assert/strict";
import { demoBooks } from "../src/lib/demo";
import { bundleBookIssue, bundleIsAvailable, printedBundleMembers } from "../src/lib/bundle-selection";
import { bundleInput } from "../src/lib/commerce-validation";
import type { Bundle } from "../src/lib/types";

const ebook = { ...demoBooks[0], is_demo: false, published: true, formats: ["PDF"], print_price_paisa: null };
const printed = { ...demoBooks[1], is_demo: false, published: true, formats: [], print_price_paisa: 20000 };
const mixed: Bundle = { id: demoBooks[2].id, slug: "mixed-pair", kind: "mixed", title_bn: "দুটি বই", title_en: "Two books",
  description_bn: "দুটি বইয়ের বান্ডেল", description_en: "Two books in a bundle", price_paisa: 30000,
  published: true, archived_at: null, members: [{ ...ebook, bundle_format: "ebook" }, { ...printed, bundle_format: "physical" }] };

test("bundle selection explains each unavailable edition instead of hiding books", () => {
  assert.equal(bundleBookIssue(ebook, "physical"), "physical");
  assert.equal(bundleBookIssue(printed, "ebook"), "ebook");
  assert.equal(bundleBookIssue(ebook, "mixed"), null);
  assert.equal(bundleBookIssue(printed, "mixed"), null);
  assert.equal(bundleBookIssue({ ...printed, published: false }, "mixed"), "draft");
  assert.equal(bundleBookIssue({ ...ebook, is_demo: true }, "ebook"), "sample");
  assert.equal(bundleBookIssue({ ...ebook, archived_at: "2026-10-17" }, "ebook"), "archived");
});
test("mixed availability uses selected editions and reserves only printed components", () => {
  assert.equal(bundleIsAvailable(mixed), true);
  assert.equal(bundleIsAvailable(mixed, 3), false);
  assert.deepEqual(printedBundleMembers(mixed).map((book) => book.id), [printed.id]);
  assert.equal(bundleIsAvailable({ ...mixed, kind: "ebook" }), false);
  assert.equal(bundleIsAvailable({ ...mixed, members: mixed.members.map((book) => ({ ...book, bundle_format: "ebook" })) }), false);
});
test("server validation rejects mixed bundles with only one format or duplicate books", () => {
  const input = { ...mixed, members: mixed.members.map((book) => ({ bookId: book.id, format: book.bundle_format })) };
  assert.equal(bundleInput.safeParse(input).success, true);
  assert.equal(bundleInput.safeParse({ ...input, members: input.members.map((book) => ({ ...book, format: "ebook" })) }).success, false);
  assert.equal(bundleInput.safeParse({ ...input, kind: "physical" }).success, false);
  assert.equal(bundleInput.safeParse({ ...input, members: [input.members[0], input.members[0]] }).success, false);
});
