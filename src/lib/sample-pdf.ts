// Original, one-page test content. Never use this in place of a seller's ebook.
export function samplePdf(title: string): Uint8Array {
  const lines = [
    title.replace(/[^\x20-\x7e]/g, "?").slice(0, 75),
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
  ];
  const escape = (value: string) => value.replace(/[\\()]/g, "\\$&");
  const stream = `BT /F1 13 Tf 50 760 Td 20 TL ${lines.map((line, index) => `${index ? "T* " : ""}(${escape(line)}) Tj`).join("\n")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index++) {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(output);
  output += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => String(offset).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(output);
}
