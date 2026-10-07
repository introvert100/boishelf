import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import createQpdf from "@neslinesli93/qpdf-wasm";
import { PDFDocument } from "pdf-lib";
import { inspectPdf, makePreviewPdf, PreviewPdfError } from "../src/lib/preview-pdf";

async function fixture(widths: number[]) {
  const pdf = await PDFDocument.create();
  for (const width of widths) pdf.addPage([width, 300]);
  return pdf.save();
}

async function encryptedFixture(bytes: Uint8Array, userPassword: string) {
  const engine = await createQpdf({
    locateFile: () => join(process.cwd(), "node_modules", "@neslinesli93", "qpdf-wasm", "dist", "qpdf.wasm"),
  });
  const fs = engine.FS as typeof engine.FS & { writeFile: (path: string, data: Uint8Array) => void };
  fs.writeFile("/source.pdf", bytes);
  assert.equal(engine.callMain([
    "/source.pdf", "/encrypted.pdf", "--encrypt", userPassword, "owner-password", "256", "--",
  ]), 0);
  return fs.readFile("/encrypted.pdf");
}

test("preview copies only the selected first pages into a separate PDF", async () => {
  const paid = await fixture([301, 302, 303]);
  assert.equal(await inspectPdf(paid), 3);
  const result = await makePreviewPdf(paid, 2, true);
  assert.equal(result.sourcePages, 3);
  const preview = await PDFDocument.load(result.bytes);
  assert.equal(preview.getPageCount(), 2);
  assert.deepEqual(preview.getPages().map((page) => page.getWidth()), [301, 302]);
  assert.ok(!preview.getPages().some((page) => page.getWidth() === 303));
});

test("paid PDFs always keep at least one page private", async () => {
  const one = await fixture([301]);
  await assert.rejects(makePreviewPdf(one, 1, true), /only one page.*reveal the whole book/);
  const three = await fixture([301, 302, 303]);
  await assert.rejects(makePreviewPdf(three, 0, true), PreviewPdfError);
  await assert.rejects(makePreviewPdf(three, 3, true), PreviewPdfError);
  await assert.rejects(makePreviewPdf(three, 4, true), PreviewPdfError);
  const sample = await makePreviewPdf(one, 1, false);
  assert.equal((await PDFDocument.load(sample.bytes)).getPageCount(), 1);
});

test("corrupt PDFs fail before an excerpt is stored", async () => {
  await assert.rejects(inspectPdf(new Uint8Array([37, 80, 68, 70])), PreviewPdfError);
  await assert.rejects(makePreviewPdf(new Uint8Array([37, 80, 68, 70]), 1, true), PreviewPdfError);
});

test("a PDF that opens without a password still produces a private-page-safe preview", async () => {
  const paid = await encryptedFixture(await fixture([301, 302, 303]), "");
  await assert.rejects(PDFDocument.load(paid));
  assert.equal(await inspectPdf(paid), 3);
  const result = await makePreviewPdf(paid, 2, true);
  assert.equal(result.sourcePages, 3);
  const preview = await PDFDocument.load(result.bytes);
  assert.deepEqual(preview.getPages().map((page) => page.getWidth()), [301, 302]);
  await assert.rejects(makePreviewPdf(paid, 3, true), /at most 2 preview pages/);
});

test("PDFs that actually need a password cannot become public previews", async () => {
  const paid = await encryptedFixture(await fixture([301, 302]), "reader-password");
  await assert.rejects(inspectPdf(paid), /could not be safely inspected/);
  await assert.rejects(makePreviewPdf(paid, 1, true), /could not be safely inspected/);
});
