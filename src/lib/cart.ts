import type { CartLine } from "./types";
const key = "read-and-rich:physical-cart:v1";
export function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const data: unknown = JSON.parse(window.localStorage.getItem(key) || "[]");
    if (!Array.isArray(data)) return [];
    return data.filter((item): item is CartLine => !!item &&
      (item.kind === "book" || item.kind === "bundle") &&
      typeof item.id === "string" && Number.isInteger(item.quantity) &&
      item.quantity >= 1 && item.quantity <= 10).slice(0, 20);
  } catch { return []; }
}
export function saveCart(lines: CartLine[]) {
  window.localStorage.setItem(key, JSON.stringify(lines));
  window.dispatchEvent(new Event("read-and-rich-cart"));
}
export function addToCart(kind: CartLine["kind"], id: string): boolean {
  const lines = readCart();
  const existing = lines.find((item) => item.kind === kind && item.id === id);
  if (existing) {
    if (existing.quantity >= 10) return false;
    existing.quantity += 1;
  } else {
    if (lines.length >= 20) return false;
    lines.push({ kind, id, quantity: 1 });
  }
  saveCart(lines);
  return true;
}
