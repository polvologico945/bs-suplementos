import type { Catalog } from "./types";

let pending: Promise<Catalog> | null = null;
let cached: { data: Catalog; expires: number } | null = null;

/** Problema: montagens repetidas consultavam o banco novamente. Cache curto e
 * deduplicação no cliente, além do CDN público, reduzem leituras. Checkout solicita
 * atualização explícita. Data: 2026-11-12. @author Carla Evelyn */
export async function loadCatalog(fresh = false): Promise<Catalog> {
  if (!fresh && cached && cached.expires > Date.now()) return cached.data;
  if (!fresh && pending) return pending;
  const request = fetch(`/api/catalog${fresh ? "?fresh=1" : ""}`, {
    cache: fresh ? "no-store" : "default",
  }).then(async (response) => {
    if (!response.ok)
      throw new Error(
        "Não foi possível atualizar o catálogo. Tente novamente em instantes.",
      );
    const data = (await response.json()) as Catalog;
    cached = { data, expires: Date.now() + 60_000 };
    return data;
  });
  if (fresh) return request;
  pending = request;
  try {
    return await request;
  } finally {
    pending = null;
  }
}
