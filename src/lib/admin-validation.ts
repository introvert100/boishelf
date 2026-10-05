import { z } from "zod";
export const bookInput = z.object({
  id: z.uuid().optional(),
  slug: z
    .string()
    .min(3, "Use 3–90 lowercase letters, numbers, and hyphens for the URL slug.")
    .max(90, "Use 3–90 lowercase letters, numbers, and hyphens for the URL slug.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens; start and end with a letter or number."),
  title_bn: z.string().trim().min(1, "Enter the Bengali title.").max(160, "Keep the Bengali title under 160 characters."),
  title_en: z.string().trim().min(1, "Enter the English title.").max(160, "Keep the English title under 160 characters."),
  author_bn: z.string().trim().min(1, "Enter the Bengali author.").max(100, "Keep the Bengali author under 100 characters."),
  author_en: z.string().trim().min(1, "Enter the English author.").max(100, "Keep the English author under 100 characters."),
  description_bn: z.string().trim().min(10, "Write at least 10 characters in the Bengali description.").max(5000, "Keep the Bengali description under 5,000 characters."),
  description_en: z.string().trim().min(10, "Write at least 10 characters in the English description.").max(5000, "Keep the English description under 5,000 characters."),
  category: z.enum(["fiction", "growth", "lifestyle", "creativity", "travel"]),
  price_paisa: z.number().int("Enter a price with no more than two decimal places.").min(1000, "Price must be at least 10 BDT.").max(10000000, "Price must be no more than 100,000 BDT."),
  pages: z.number().int("Enter a whole number of pages.").min(1, "Pages must be between 1 and 20,000.").max(20000, "Pages must be between 1 and 20,000."),
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
export type UploadKind = "cover" | "pdf" | "epub";
export function uploadProblem(kind: UploadKind, name: string, size: number, mime?: string): string | null {
  const limit = (kind === "cover" ? 5 : 30) * 1024 * 1024;
  if (!size || size > limit)
    return kind === "cover" ? "Choose a cover between 1 byte and 5 MB." : `Choose ${kind === "epub" ? "an EPUB" : "a PDF"} between 1 byte and 30 MB.`;
  if (!(kind === "cover" ? /\.(png|jpe?g|webp)$/i : new RegExp(`\\.${kind}$`, "i")).test(name))
    return kind === "cover" ? "Choose a PNG, JPG, or WebP cover." : `Choose a .${kind} file.`;
  if (mime && kind === "cover" && !(
    (mime === "image/png" && /\.png$/i.test(name)) ||
    (mime === "image/jpeg" && /\.jpe?g$/i.test(name)) ||
    (mime === "image/webp" && /\.webp$/i.test(name))
  )) return "The cover filename does not match its image format. Rename or convert the file and try again.";
  return null;
}
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
