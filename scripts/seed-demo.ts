import { createClient } from "@supabase/supabase-js";
import { zipSync, strToU8 } from "fflate";
import { demoBooks } from "../src/lib/demo";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key)
  throw new Error("Configure Supabase in .env.local before seeding.");
if (process.env.PAYMENT_MODE === "live")
  throw new Error("Demo seeding is disabled in live payment mode.");
const db = createClient(url, key, { auth: { persistSession: false } });
function pdf(title: string) {
  const lines = [
    title,
    "An original BoiShelf sample",
    "",
    "A small invitation to read",
    "",
    "A book can begin with a quiet moment. Set aside your phone, find a",
    "comfortable place, and give yourself a few minutes to discover a",
    "different perspective. You do not need to finish a chapter today.",
    "One thoughtful page can be enough to start a new habit.",
    "",
    "This sample is created for the BoiShelf pilot. It demonstrates the",
    "purchase and download experience. It is not a full commercial book.",
    "",
    "Thank you for visiting BoiShelf. Happy reading.",
  ];
  const escape = (s: string) => s.replace(/[\\()]/g, "\\$&");
  const stream = `BT /F1 13 Tf 50 760 Td 20 TL ${lines.map((l, i) => `${i ? "T* " : ""}(${escape(l)}) Tj`).join("\n")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let result = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(result));
    result += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(result);
  result += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((o) => String(o).padStart(10, "0") + " 00000 n \n")
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(result);
}
function epub(title: string, id: string) {
  const esc = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
  return zipSync(
    {
      mimetype: [strToU8("application/epub+zip"), { level: 0 }],
      "META-INF/container.xml": strToU8(
        '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
      ),
      "OEBPS/content.opf": strToU8(
        `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">urn:uuid:${id}</dc:identifier><dc:title>${esc(title)}</dc:title><dc:language>en</dc:language><dc:creator>BoiShelf Editorial</dc:creator><meta property="dcterms:modified">2026-10-02T00:00:00Z</meta></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref idref="chapter"/></spine></package>`,
      ),
      "OEBPS/nav.xhtml": strToU8(
        '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><h1>Contents</h1><ol><li><a href="chapter.xhtml">A small invitation to read</a></li></ol></nav></body></html>',
      ),
      "OEBPS/chapter.xhtml": strToU8(
        `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${esc(title)}</title></head><body><h1>${esc(title)}</h1><p>An original BoiShelf sample.</p><h2>A small invitation to read</h2><p>A book can begin with a quiet moment. Set aside your phone, find a comfortable place, and give yourself a few minutes to discover a different perspective. You do not need to finish a chapter today. One thoughtful page can be enough to start a new habit.</p><p>This original sample demonstrates the BoiShelf pilot purchase and download experience. It is not a full commercial book.</p><p>Happy reading.</p></body></html>`,
      ),
    },
    { level: 6 },
  );
}
async function main() {
  for (const book of demoBooks) {
    const { data: existing, error: lookup } = await db
      .from("books")
      .select("id")
      .eq("id", book.id)
      .maybeSingle();
    if (lookup) throw lookup;
    if (existing) {
      console.log(`Skipped existing sample: ${book.slug}`);
      continue;
    }
    const { formats, ...record } = book;
    const { error } = await db
      .from("books")
      .insert({ ...record, pages: 1, language: "en", published: false });
    if (error) throw error;
    for (const format of formats) {
      const f = format.toLowerCase();
      const bytes =
        f === "pdf" ? pdf(book.title_en) : epub(book.title_en, book.id);
      const path = `${book.id}/sample.${f}`;
      const { error: upload } = await db.storage
        .from("ebooks")
        .upload(path, bytes, {
          contentType: f === "pdf" ? "application/pdf" : "application/epub+zip",
          upsert: false,
        });
      if (upload) throw upload;
      const { error: save } = await db
        .from("book_formats")
        .insert({
          book_id: book.id,
          format: f,
          storage_path: path,
          original_name: `${book.slug}-sample.${f}`,
          size_bytes: bytes.length,
        });
      if (save) throw save;
    }
    const { error: publish } = await db
      .from("books")
      .update({ published: true })
      .eq("id", book.id);
    if (publish) throw publish;
    console.log(`Created original sample: ${book.slug}`);
  }
}
main().catch(() => {
  console.error(
    "Demo seed failed. Check database setup and bucket permissions; no secrets are logged. Existing books are not overwritten.",
  );
  process.exitCode = 1;
});
