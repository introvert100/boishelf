import type { Book } from "./types";

export type BookFormValues = {
  title_bn: string; title_en: string; author_bn: string; author_en: string;
  description_bn: string; description_en: string; slug: string; price: string;
  pages: string; category: string; language: string; cover_style: string;
  published: boolean; is_demo: boolean; featured: boolean;
};

export const blankBook: BookFormValues = {
  title_bn: "", title_en: "", author_bn: "", author_en: "",
  description_bn: "", description_en: "", slug: "", price: "199",
  pages: "100", category: "fiction", language: "bn", cover_style: "forest",
  published: false, is_demo: false, featured: false,
};

const textFields = ["title_bn", "title_en", "author_bn", "author_en", "description_bn", "description_en", "slug", "price", "pages", "category", "language", "cover_style"] as const;
const booleanFields = ["published", "is_demo", "featured"] as const;

export function draftKey(ownerId: string) {
  return `boishelf:book-draft:v1:${ownerId}`;
}

export function parseBookDraft(raw: string | null): BookFormValues | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !parsed.values || typeof parsed.values !== "object") return null;
    const values = { ...blankBook };
    for (const field of textFields) {
      if (typeof parsed.values[field] !== "string") return null;
      values[field] = parsed.values[field];
    }
    for (const field of booleanFields) {
      if (typeof parsed.values[field] !== "boolean") return null;
      values[field] = parsed.values[field];
    }
    return values;
  } catch {
    return null;
  }
}

export function bookValues(book: Book): BookFormValues {
  return {
    title_bn: book.title_bn, title_en: book.title_en,
    author_bn: book.author_bn, author_en: book.author_en,
    description_bn: book.description_bn, description_en: book.description_en,
    slug: book.slug, price: (book.price_paisa / 100).toString(),
    pages: String(book.pages), category: book.category, language: book.language,
    cover_style: book.cover_style, published: book.published,
    is_demo: book.is_demo, featured: book.featured,
  };
}
