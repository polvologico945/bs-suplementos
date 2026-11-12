import type { CartEntry, CartItem, Product } from "./types";
export const CART_KEY = "bs-cart";
export const MAX_QUANTITY = 99;

/**
 * Problema: JSON inválido derrubava a loja e cópias completas mantinham preços
 * antigos. Persiste apenas identidade/sabor/quantidade e migra o formato anterior.
 * Preço e disponibilidade sempre vêm do catálogo atual.
 * Data: 2026-11-12. @author Carla Evelyn
 */
export function parseCart(raw: string | null): CartEntry[] {
  try {
    const value: unknown = JSON.parse(raw || "[]");
    const entries = Array.isArray(value) ? value : [];
    const result: CartEntry[] = [];
    for (const entry of entries.slice(0, 200)) {
      if (
        !entry ||
        typeof entry !== "object" ||
        typeof entry.id !== "string" ||
        !entry.id ||
        entry.id.length > 100
      )
        continue;
      if (!Number.isFinite(entry.quantity) || entry.quantity < 1) continue;
      const flavor =
        typeof entry.flavor === "string" ? entry.flavor.slice(0, 80) : null;
      const quantity = Math.min(MAX_QUANTITY, Math.floor(entry.quantity));
      const existing = result.find(
        (item) => item.id === entry.id && item.flavor === flavor,
      );
      if (existing)
        existing.quantity = Math.min(
          MAX_QUANTITY,
          existing.quantity + quantity,
        );
      else result.push({ id: entry.id, flavor, quantity });
    }
    return result;
  } catch {
    return [];
  }
}

export function reconcileCart(
  entries: CartEntry[],
  products: Product[],
): CartItem[] {
  return entries.flatMap((entry) => {
    const product = products.find(
      (p) => p.id === entry.id && p.active && p.stock_status !== "unavailable",
    );
    if (!product) return [];
    if (
      product.flavors.length
        ? !entry.flavor || !product.flavors.includes(entry.flavor)
        : entry.flavor !== null
    )
      return [];
    return [{ ...product, ...entry }];
  });
}
export function cartEntries(items: CartItem[]): CartEntry[] {
  return items.map(({ id, flavor, quantity }) => ({ id, flavor, quantity }));
}
export const unitPrice = (product: Product) =>
  product.promotional_price ?? product.price;
export const cartTotal = (items: CartItem[]) =>
  items.reduce((sum, item) => sum + (unitPrice(item) ?? 0) * item.quantity, 0);
export function sameCart(before: CartItem[], after: CartItem[]): boolean {
  return (
    before.length === after.length &&
    before.every((item, index) => {
      const next = after[index];
      return (
        item.id === next.id &&
        item.flavor === next.flavor &&
        item.quantity === next.quantity &&
        unitPrice(item) === unitPrice(next)
      );
    })
  );
}
