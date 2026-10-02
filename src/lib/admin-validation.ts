import { z } from "zod";
export const bookInput = z.object({
  id: z.uuid().optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .min(3)
    .max(90),
  title_bn: z.string().trim().min(1).max(160),
  title_en: z.string().trim().min(1).max(160),
  author_bn: z.string().trim().min(1).max(100),
  author_en: z.string().trim().min(1).max(100),
  description_bn: z.string().trim().min(10).max(5000),
  description_en: z.string().trim().min(10).max(5000),
  category: z.enum(["fiction", "growth", "lifestyle", "creativity", "travel"]),
  price_paisa: z.number().int().min(1000).max(10000000),
  pages: z.number().int().min(1).max(20000),
  language: z.enum(["bn", "en"]),
  cover_style: z.enum([
    "forest",
    "blue",
    "orange",
    "pink",
    "olive",
    "violet",
    "yellow",
    "red",
  ]),
  published: z.boolean(),
  is_demo: z.boolean(),
  featured: z.boolean(),
});
export const policyInput = z
  .object({
    slug: z.enum(["privacy", "terms", "refund", "copyright"]),
    title_bn: z.string().trim().min(1).max(120),
    title_en: z.string().trim().min(1).max(120),
    body_bn: z.string().trim().max(50000),
    body_en: z.string().trim().max(50000),
    published: z.boolean(),
  })
  .refine(
    (x) => !x.published || (x.body_bn.length >= 30 && x.body_en.length >= 30),
    "Provide both language versions before publishing.",
  );
export function detectUpload(bytes: Uint8Array, kind: string): string | null {
  if (kind === "pdf" && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-")
    return "application/pdf";
  if (
    kind === "epub" &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    new TextDecoder()
      .decode(bytes.slice(0, 256))
      .includes("application/epub+zip")
  )
    return "application/epub+zip";
  if (kind === "cover") {
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    )
      return "image/png";
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
      return "image/jpeg";
    if (
      new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
    )
      return "image/webp";
  }
  return null;
}
