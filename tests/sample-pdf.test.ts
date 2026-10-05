import { test } from "node:test";
import assert from "node:assert/strict";
import { samplePdf } from "../src/lib/sample-pdf";
import { detectUpload } from "../src/lib/admin-validation";

test("sample PDF is a complete downloadable PDF with original test content", () => {
  const bytes = samplePdf("A (test) \\ title");
  const output = new TextDecoder().decode(bytes);
  assert.equal(detectUpload(bytes, "pdf"), "application/pdf");
  assert.ok(output.includes("A \\(test\\) \\\\ title"));
  assert.match(output, /An original BoiShelf sample/);
  assert.match(output, /xref\n0 6\n/);
  assert.match(output, /startxref\n\d+\n%%EOF$/);
  assert.ok(bytes.length < 100_000);
});
