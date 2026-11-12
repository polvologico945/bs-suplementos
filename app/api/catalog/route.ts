import { readPublicCatalog } from "@/lib/catalog-server";
export async function GET(request: Request) {
  try {
    const data = await readPublicCatalog();
    const fresh = new URL(request.url).searchParams.get("fresh") === "1";
    return Response.json(data, {
      headers: {
        "Cache-Control":
          fresh || data.demo
            ? "no-store"
            : "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
        "Vercel-CDN-Cache-Control":
          fresh || data.demo
            ? "no-store"
            : "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch {
    // Nunca substituir a loja real por produtos de demonstração durante uma falha.
    return Response.json(
      { error: "Catálogo temporariamente indisponível." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
