import { describe, expect, it } from "vitest";
import {
  cartEntries,
  cartTotal,
  parseCart,
  reconcileCart,
  sameCart,
} from "../lib/cart";
import { demoProducts } from "../lib/demo-data";

describe("carrinho persistente", () => {
  it.each([null, "", "{invalido", "{}", '[null,1,"produto"]'])(
    "tolera dados corrompidos: %s",
    (raw) => expect(parseCart(raw)).toEqual([]),
  );
  it("migra o formato anterior, limita quantidades e elimina cópias", () => {
    const raw = JSON.stringify([
      { ...demoProducts[0], quantity: 99 },
      { id: "p-1", quantity: 8 },
      { id: "p-2", quantity: -1 },
    ]);
    expect(parseCart(raw)).toEqual([{ id: "p-1", flavor: null, quantity: 99 }]);
  });
  it("descarta itens indisponíveis e sabores removidos e usa preços atuais", () => {
    const product = { ...demoProducts[0], price: 20, flavors: ["Chocolate"] };
    const entries = parseCart(
      '[{"id":"p-1","quantity":2,"flavor":"Chocolate","price":1},{"id":"p-1","quantity":1,"flavor":"Morango"},{"id":"removido","quantity":3}]',
    );
    const cart = reconcileCart(entries, [product]);
    expect(cart).toHaveLength(1);
    expect(cartTotal(cart)).toBe(40);
    expect(cartEntries(cart)).toEqual([
      { id: "p-1", quantity: 2, flavor: "Chocolate" },
    ]);
    expect(
      reconcileCart(entries, [{ ...product, stock_status: "unavailable" }]),
    ).toEqual([]);
  });
  it("considera promoção zero válida e detecta mudanças antes do WhatsApp", () => {
    const entries = [{ id: "p-1", quantity: 2, flavor: null }];
    const a = reconcileCart(entries, [{ ...demoProducts[0], price: 20 }]);
    const b = reconcileCart(entries, [
      { ...demoProducts[0], price: 20, promotional_price: 0 },
    ]);
    expect(cartTotal(b)).toBe(0);
    expect(sameCart(a, b)).toBe(false);
  });
});
