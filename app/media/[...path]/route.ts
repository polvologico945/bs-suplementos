import sharp from "sharp";
export const runtime = "nodejs";
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

/**
 * Problema: originais de vários MB e variantes por tamanho consumiam as franquias.
 * O CDN entrega um único WebP por caminho, inclusive para fotos antigas. A origem
 * é fixa, pública e limitada ao bucket catalog; falhas não recebem cache longo.
 * Objetos novos têm nome pelo hash e nunca são sobrescritos.
 * Data: 2026-11-12. @author Carla Evelyn
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const requestUrl = new URL(request.url);
  if (requestUrl.search)
    return Response.redirect(
      new URL(requestUrl.pathname, requestUrl.origin),
      308,
    );
  const { path } = await context.params;
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !path.length ||
    path.join("/").length > 1000 ||
    path.some(
      (part) =>
        !part || part === "." || part === ".." || /[\\/\x00-\x1f]/.test(part),
    )
  )
    return new Response(null, { status: 404 });
  const source = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/catalog/${path.map(encodeURIComponent).join("/")}`;
  try {
    const upstream = await fetch(source, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (
      !upstream.ok ||
      !upstream.headers.get("content-type")?.startsWith("image/")
    )
      return new Response(null, {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    if (Number(upstream.headers.get("content-length")) > MAX_SOURCE_BYTES)
      throw new Error("Imagem muito grande.");
    const reader = upstream.body?.getReader();
    if (!reader) throw new Error("Imagem vazia.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_SOURCE_BYTES) {
        await reader.cancel();
        throw new Error("Imagem muito grande.");
      }
      chunks.push(value);
    }
    let bytes = Buffer.concat(chunks);
    if (
      /\.hei[cf]$/i.test(path.at(-1) || "") ||
      /image\/hei[cf]/i.test(upstream.headers.get("content-type") || "")
    ) {
      const { default: convert } = await import("heic-convert");
      bytes = Buffer.from(
        await convert({ buffer: bytes, format: "JPEG", quality: 0.9 }),
      );
    }
    const image = sharp(bytes, { limitInputPixels: 40_000_000 }).rotate();
    const metadata = await image.metadata();
    const output =
      metadata.format === "webp" &&
      Math.max(metadata.width || 0, metadata.height || 0) <= 1200 &&
      bytes.length <= 350_000
        ? bytes
        : await image
            .resize({
              width: 1200,
              height: 1200,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({ quality: 76, effort: 4 })
            .toBuffer();
    const immutable = /^v2\/[a-f0-9]{64}\.webp$/.test(path.join("/"));
    return new Response(new Uint8Array(output), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(output.length),
        "Cache-Control": immutable
          ? "public, max-age=31536000, immutable"
          : "public, max-age=86400, stale-while-revalidate=604800",
        "Vercel-CDN-Cache-Control":
          "public, max-age=2592000, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
