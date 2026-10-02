export type Locale = "bn" | "en";
export type PaymentMode = "sandbox" | "live";
export type OrderStatus =
  "pending" | "paid" | "failed" | "cancelled" | "review" | "refunded";
export type Book = {
  id: string;
  slug: string;
  title_bn: string;
  title_en: string;
  author_bn: string;
  author_en: string;
  description_bn: string;
  description_en: string;
  category: string;
  price_paisa: number;
  pages: number;
  language: string;
  cover_path: string | null;
  cover_style: string;
  formats: string[];
  published: boolean;
  is_demo: boolean;
  featured: boolean;
  created_at?: string;
};
export type Viewer = { email: string; name: string; admin: boolean } | null;
export type Order = {
  id: string;
  user_id: string;
  book_id: string;
  book_title: string;
  amount_paisa: number;
  mode: PaymentMode;
  status: OrderStatus;
  tran_id: string;
  created_at: string;
};
export type Policy = {
  slug: string;
  title_en: string;
  title_bn: string;
  body_en: string;
  body_bn: string;
  published: boolean;
};
export const policySlugs = ["privacy", "terms", "refund", "copyright"] as const;
