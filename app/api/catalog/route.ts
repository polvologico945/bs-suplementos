import { readPublicCatalog } from "@/lib/catalog-server";
import { failureDiagnostics } from "@/lib/catalog-errors";

export async function GET(request: Request) {
  try {
    const { diagnostics, ...data } = await readPublicCatalog();
    const fresh = new URL(request.url).searchParams.get("fresh") === "1";
    const noCache = fresh || data.demo || diagnostics.length > 0;
    if (diagnostics.length)
      console.warn(
        "[catalog] Catálogo parcial; confira estes recursos:",
        diagnostics,
      );
    return Response.json(
      process.env.NODE_ENV === "development" && diagnostics.length
        ? { ...data, diagnostics }
        : data,
      {
        headers: {
          "Cache-Control": noCache
            ? "no-store"
            : "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
          "Vercel-CDN-Cache-Control": noCache
            ? "no-store"
            : "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    const diagnostics = failureDiagnostics(error);
    console.error("[catalog] Falha ao consultar o Supabase:", diagnostics);
    // Produção mantém mensagem pública; em localhost o JSON identifica a causa
    // sem expor credenciais ou registros. Data: 2026-11-12. @author Carla Evelyn
    return Response.json(
      {
        error: "Catálogo temporariamente indisponível.",
        ...(process.env.NODE_ENV === "development" ? { diagnostics } : {}),
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Vercel-CDN-Cache-Control": "no-store",
        },
      },
    );
  }
}
