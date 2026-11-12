"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type SetStateAction,
} from "react";
import { CART_KEY, cartEntries, parseCart, reconcileCart } from "@/lib/cart";
import type { CartEntry, CartItem, Product } from "@/lib/types";

export function useCart(products: Product[], catalogReady: boolean) {
  const [entries, setEntries] = useState<CartEntry[]>(() => {
    try {
      return typeof window === "undefined"
        ? []
        : parseCart(localStorage.getItem(CART_KEY));
    } catch {
      return [];
    }
  });
  const [notice, setCartNotice] = useState("");
  const cart = useMemo(
    () => reconcileCart(entries, products),
    [entries, products],
  );
  const setCart = useCallback(
    (action: SetStateAction<CartItem[]>) => {
      setEntries((previous) =>
        cartEntries(
          typeof action === "function"
            ? action(reconcileCart(previous, products))
            : action,
        ),
      );
    },
    [products],
  );
  useEffect(() => {
    if (!catalogReady) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cartEntries(cart)));
    } catch {
      /* Navegação continua em memória quando o armazenamento está bloqueado. */
    }
  }, [cart, catalogReady]);
  const cartNotice =
    notice ||
    (catalogReady && entries.length > cart.length
      ? "Removemos itens ou sabores que não estão mais disponíveis."
      : "");
  return { cart, setCart, cartNotice, setCartNotice };
}
