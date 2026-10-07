import { PDFDocument, PDFName } from "pdf-lib";

export class PreviewPdfError extends Error {}

export async function inspectPdf(bytes: Uint8Array): Promise<number> {
  if (bytes.length === 0 || bytes.length > 30 * 1024 * 1024)
    throw new PreviewPdfError("Choose a PDF between 1 byte and 30 MB.");
  try {
    const document = await PDFDocument.load(bytes, { updateMetadata: false });
    const count = document.getPageCount();
    if (count < 1 || count > 20000) throw new Error("Invalid page count");
    return count;
  } catch {
    throw new PreviewPdfError("This PDF is corrupt, encrypted, or unsupported. Upload an unprotected sample PDF instead.");
  }
}

export async function makePreviewPdf(bytes: Uint8Array, pages: number, keepOnePrivate: boolean) {
  if (bytes.length === 0 || bytes.length > 30 * 1024 * 1024)
    throw new PreviewPdfError("Choose a PDF between 1 byte and 30 MB.");
  if (!Number.isInteger(pages) || pages < 1)
    throw new PreviewPdfError("Enter a whole number of preview pages greater than zero.");
  let source: PDFDocument;
  try { source = await PDFDocument.load(bytes, { updateMetadata: false }); }
  catch { throw new PreviewPdfError("This PDF is corrupt, encrypted, or unsupported. Upload an unprotected sample PDF instead."); }
  const total = source.getPageCount();
  if (total < 1 || total > 20000)
    throw new PreviewPdfError("The PDF page count is not supported.");
  if (pages > total || (keepOnePrivate && pages >= total))
    throw new PreviewPdfError(keepOnePrivate
      ? `Choose at most ${Math.max(0, total - 1)} preview pages so at least one page stays private.`
      : `This sample PDF has only ${total} pages.`);
  const excerpt = await PDFDocument.create();
  const copied = await excerpt.copyPages(source, Array.from({ length: pages }, (_, index) => index));
  for (const page of copied) {
    // A preview is a new document; annotations may reference hidden pages or attachments.
    page.node.delete(PDFName.of("Annots"));
    excerpt.addPage(page);
  }
  excerpt.setTitle("BoiShelf preview");
  const output = await excerpt.save();
  if (output.length > 30 * 1024 * 1024)
    throw new PreviewPdfError("The preview is too large. Choose fewer pages or upload a smaller sample PDF.");
  return { bytes: output, sourcePages: total };
}
