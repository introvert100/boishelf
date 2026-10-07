import { join } from "node:path";
import createQpdf from "@neslinesli93/qpdf-wasm";
import { PDFDocument, PDFName } from "pdf-lib";
import { ebookLimitBytes, ebookLimitMb } from "./upload-limits";

export class PreviewPdfError extends Error {}

type QpdfEngine = Awaited<ReturnType<typeof createQpdf>>;

function callQpdf(engine: QpdfEngine, args: string[]) {
  // The WASM CLI changes Node's global exit code for ordinary status checks.
  const previousExitCode = process.exitCode;
  try { return engine.callMain(args); }
  finally { process.exitCode = previousExitCode; }
}

const unreadableError = "This PDF could not be safely inspected. Export a fresh PDF and try again.";

function checkSize(bytes: Uint8Array) {
  if (bytes.length === 0 || bytes.length > ebookLimitBytes)
    throw new PreviewPdfError(`Choose a PDF between 1 byte and ${ebookLimitMb} MB.`);
}

function checkPageCount(total: number) {
  if (!Number.isInteger(total) || total < 1 || total > 20000)
    throw new PreviewPdfError("The PDF page count is not supported.");
  return total;
}

function checkSelection(pages: number, total: number, keepOnePrivate: boolean) {
  if (pages > total || (keepOnePrivate && pages >= total))
    throw new PreviewPdfError(keepOnePrivate && total === 1
      ? "This PDF has only one page. A free preview would reveal the whole book. Upload a multi-page PDF."
      : keepOnePrivate
        ? `Choose at most ${Math.max(0, total - 1)} preview pages so at least one page stays private.`
        : `This sample PDF has only ${total} pages.`);
}

async function safeExcerpt(document: PDFDocument, pages: number, sourcePages: number) {
  if (document.getPageCount() !== pages) throw new PreviewPdfError(unreadableError);
  for (const page of document.getPages()) {
    // Annotations may link to paid pages or contain attachments.
    page.node.delete(PDFName.of("Annots"));
  }
  document.setTitle("BoiShelf preview");
  const output = await document.save();
  if (output.length > ebookLimitBytes)
    throw new PreviewPdfError("The preview is too large. Choose fewer pages or upload a smaller sample PDF.");
  return { bytes: output, sourcePages };
}

async function withQpdf<T>(bytes: Uint8Array, action: (engine: QpdfEngine, total: number) => Promise<T>): Promise<T> {
  const engine = await createQpdf({
    locateFile: () => join(process.cwd(), "node_modules", "@neslinesli93", "qpdf-wasm", "dist", "qpdf.wasm"),
  });
  const fs = engine.FS as typeof engine.FS & {
    writeFile: (path: string, data: Uint8Array) => void;
    unlink: (path: string) => void;
  };
  fs.writeFile("/input.pdf", bytes);
  try {
    // A PDF that opens without a password may still have an encryption dictionary.
    const status = callQpdf(engine, [
      "--json", "--json-key=pages", "--json-stream-data=none", "/input.pdf", "/pages.json",
    ]);
    if (status !== 0 && status !== 3) throw new PreviewPdfError(unreadableError);
    let count: number;
    try {
      const metadata = JSON.parse(Buffer.from(fs.readFile("/pages.json")).toString("utf8")) as { pages?: unknown };
      count = Array.isArray(metadata.pages) ? metadata.pages.length : 0;
    } catch { throw new PreviewPdfError(unreadableError); }
    return await action(engine, checkPageCount(count));
  } finally {
    fs.unlink("/input.pdf");
    try { fs.unlink("/pages.json"); } catch { /* Inspection may have failed first. */ }
  }
}

export async function inspectPdf(bytes: Uint8Array): Promise<number> {
  checkSize(bytes);
  try {
    const document = await PDFDocument.load(bytes, { updateMetadata: false });
    return checkPageCount(document.getPageCount());
  } catch (error) {
    if (error instanceof PreviewPdfError) throw error;
    return withQpdf(bytes, async (_engine, total) => total);
  }
}

async function makePreviewWithQpdf(bytes: Uint8Array, pages: number, keepOnePrivate: boolean) {
  return withQpdf(bytes, async (engine, total) => {
    checkSelection(pages, total, keepOnePrivate);
    const status = callQpdf(engine, [
      "--empty", "--pages", "/input.pdf", `1-${pages}`, "--", "/excerpt.pdf",
    ]);
    if (status !== 0 && status !== 3) throw new PreviewPdfError(unreadableError);
    let excerpt: PDFDocument;
    try { excerpt = await PDFDocument.load(engine.FS.readFile("/excerpt.pdf"), { updateMetadata: false }); }
    catch { throw new PreviewPdfError(unreadableError); }
    return safeExcerpt(excerpt, pages, total);
  });
}

export async function makePreviewPdf(bytes: Uint8Array, pages: number, keepOnePrivate: boolean) {
  checkSize(bytes);
  if (!Number.isInteger(pages) || pages < 1)
    throw new PreviewPdfError("Enter a whole number of preview pages greater than zero.");
  try {
    const source = await PDFDocument.load(bytes, { updateMetadata: false });
    const total = checkPageCount(source.getPageCount());
    checkSelection(pages, total, keepOnePrivate);
    const excerpt = await PDFDocument.create();
    const copied = await excerpt.copyPages(source, Array.from({ length: pages }, (_, index) => index));
    for (const page of copied) excerpt.addPage(page);
    return await safeExcerpt(excerpt, pages, total);
  } catch (error) {
    if (error instanceof PreviewPdfError) throw error;
    return makePreviewWithQpdf(bytes, pages, keepOnePrivate);
  }
}
