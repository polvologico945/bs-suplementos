const LOCAL_FALLBACK = "/brand/logo-card.jpg";

/**
 * Problema: tamanhos diferentes no next/image geravam novas transformações ao abrir
 * o carrinho. Uma URL canônica compartilha os mesmos bytes no catálogo e no painel.
 * A rota só permite imagens públicas do bucket da loja; não é um proxy aberto.
 * Data: 2026-11-12. @author Carla Evelyn
 */
export function mediaUrl(source: string | null | undefined): string {
  if (!source) return LOCAL_FALLBACK;
  if (source.startsWith("/brand/") && !source.includes("..")) return source;
  try {
    const url = new URL(source);
    const storage = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
    const prefix = "/storage/v1/object/public/catalog/";
    if (url.origin !== storage.origin || !url.pathname.startsWith(prefix))
      return LOCAL_FALLBACK;
    const path = url.pathname.slice(prefix.length);
    if (
      !path ||
      path
        .split("/")
        .some((part) => [".", ".."].includes(decodeURIComponent(part)))
    )
      return LOCAL_FALLBACK;
    return `/media/${path}`;
  } catch {
    return LOCAL_FALLBACK;
  }
}
