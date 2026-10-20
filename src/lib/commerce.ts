import "server-only";
import { serviceClient } from "./supabase";
import { codCheckoutEnabled, manualCheckoutEnabled, ownerEmail } from "./config";
import { paymentSettings } from "./payment-settings";
import { getBooks } from "./catalog";
import { getBundles } from "./bundles";
import { cartInput, districts } from "./commerce-validation";
import { AppError } from "./http";
import { printedBundleMembers } from "./bundle-selection";
import type { CartLine } from "./types";

export async function shippingRates() {
  const { data, error } = await serviceClient().from("shipping_settings")
    .select("dhaka_paisa,outside_paisa").eq("id", "default").single();
  if (error) throw error;
  return data as { dhaka_paisa: number | null; outside_paisa: number | null };
}

export async function physicalReadiness() {
  const { receivingNumber } = await paymentSettings();
  const db = serviceClient();
  const [{ data: policies, error: policyError }, rates, { data: stock, error: stockError }] = await Promise.all([
    db.from("policies").select("slug,body_bn,body_en").eq("published", true),
    shippingRates(),
    db.from("print_editions").select("book_id,on_hand,reserved,books!inner(published,is_demo,archived_at)")
      .gt("on_hand", 0).limit(100),
  ]);
  if (policyError || stockError) throw policyError || stockError;
  const required = ["privacy","terms","refund","shipping"];
  const policyReady = required.every((slug) => policies?.some((p) =>
    p.slug === slug && p.body_bn.trim() && p.body_en.trim()));
  const catalogueReady = !!stock?.some((item) => {
    const raw = item.books as unknown as { published: boolean; is_demo: boolean; archived_at: string | null } |
      { published: boolean; is_demo: boolean; archived_at: string | null }[];
    const book = Array.isArray(raw) ? raw[0] : raw;
    return book?.published && !book.is_demo && !book.archived_at && item.on_hand > item.reserved;
  });
  const baseReady = /^[^@\s]+@gmail\.com$/.test(ownerEmail()) && policyReady &&
    catalogueReady && rates.dhaka_paisa !== null && rates.outside_paisa !== null;
  return {
    cod: baseReady && codCheckoutEnabled(),
    bkash: baseReady && manualCheckoutEnabled() && !!receivingNumber,
    gates: [
      { key: "courier", label: "COD-capable courier confirmed", passed: process.env.COD_COURIER_CONFIRMED === "true" },
      { key: "shipping", label: "Dhaka and outside-Dhaka fees configured", passed: rates.dhaka_paisa !== null && rates.outside_paisa !== null },
      { key: "shipping_policy", label: "Shipping and customer policies published", passed: policyReady },
      { key: "stock", label: "Published printed book in stock", passed: catalogueReady },
      { key: "cod", label: "COD checkout enabled", passed: codCheckoutEnabled() },
    ],
  };
}

export async function quotePhysicalCart(linesInput: unknown, district: string) {
  const lines = cartInput.parse(linesInput);
  if (!districts.includes(district as typeof districts[number]))
    throw new AppError(400, "Choose a Bangladesh district.");
  const [rates, books] = await Promise.all([shippingRates(), getBooks()]);
  const bundles = await getBundles(false, books);
  const required = new Map<string, number>();
  let subtotal = 0;
  const items = lines.map((line: CartLine) => {
    const product = line.kind === "book"
      ? books.find((b) => b.id === line.id && !b.is_demo && b.print_price_paisa != null)
      : bundles.find((b) => b.id === line.id && b.kind === "physical");
    if (!product) throw new AppError(409, "A printed item is no longer available. Refresh your cart.");
    const members = line.kind === "book" ? [product as typeof books[number]] : printedBundleMembers(product as typeof bundles[number]);
    for (const member of members)
      required.set(member.id, (required.get(member.id) || 0) + line.quantity);
    const price = line.kind === "book" ? (product as typeof books[number]).print_price_paisa! : product.price_paisa;
    subtotal += price * line.quantity;
    return { ...line, title_bn: product.title_bn, title_en: product.title_en, unit_price_paisa: price };
  });
  for (const [bookId, quantity] of required) {
    const book = books.find((b) => b.id === bookId);
    if (!book || (book.print_on_hand || 0) - (book.print_reserved || 0) < quantity)
      throw new AppError(409, "A printed book in your cart is out of stock. Change the quantity and retry.");
  }
  const fee = district === "Dhaka" ? rates.dhaka_paisa : rates.outside_paisa;
  if (fee === null) throw new AppError(503, "Delivery fees are not configured yet.");
  return { items, subtotal_paisa: subtotal, shipping_fee_paisa: fee,
    total_paisa: subtotal + fee, district };
}
