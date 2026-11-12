import { createClient } from "@supabase/supabase-js";
import { demoCategories, demoProducts, demoSettings } from "./demo-data";
import {
  CatalogReadError,
  networkDiagnostic,
  queryDiagnostic,
  type CatalogDiagnostic,
} from "./catalog-errors";
import type { Catalog, Product } from "./types";
import { galleryImages } from "./images/gallery";

const TIMEOUT_MS = 20_000;
const PRODUCT_FIELDS =
  "id,category_id,product_type_id,brand_id,name,brand,description,price,promotional_price,image_url,flavors,active,featured,stock_status,sort_order";
const GALLERY_PRODUCT_FIELDS = `${PRODUCT_FIELDS},image_urls`;
const LEGACY_PRODUCT_FIELDS =
  "id,category_id,name,brand,description,price,promotional_price,image_url,active,featured,stock_status,sort_order";

function configurationError(code: string, hint: string): never {
  throw new CatalogReadError([
    { resource: "configuration", code, reason: "configuration", hint },
  ]);
}

export async function readPublicCatalog(): Promise<
  Catalog & { diagnostics: CatalogDiagnostic[] }
> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url && !key && process.env.VERCEL_ENV !== "production") {
    return {
      settings: demoSettings,
      categories: demoCategories,
      productTypes: [],
      products: demoProducts,
      demo: true,
      diagnostics: [],
    };
  }
  if (!url || !key)
    configurationError(
      "SUPABASE_ENV_MISSING",
      "Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env.local ou no ambiente do deploy e reinicie/republique.",
    );
  try {
    const parsed = new URL(url);
    if (
      !["https:", "http:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      !["", "/"].includes(parsed.pathname)
    )
      throw new Error();
  } catch {
    configurationError(
      "SUPABASE_URL_INVALID",
      "Use a Project URL do Supabase, como https://seu-projeto.supabase.co, sem /rest/v1 ou endereço do painel.",
    );
  }
  if (key.startsWith("sb_secret_"))
    configurationError(
      "SUPABASE_KEY_INVALID",
      "Use a Publishable key do projeto neste campo, nunca uma chave secreta.",
    );

  // Cliente anônimo sem cookies: somente respostas públicas podem ir ao CDN.
  const transport = new Map<string, CatalogDiagnostic>();
  const db = createClient(url, key, {
    // Problema: 8 s interrompiam conexões lentas/iniciais sem identificar a causa.
    // Um prazo de 20 s só afeta cache miss; não cria retries ou consultas periódicas.
    // Data: 2026-11-12. @author Carla Evelyn
    db: { retry: false, timeout: TIMEOUT_MS },
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const address =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        const resource =
          new URL(address).pathname.split("/rest/v1/")[1] || "supabase";
        try {
          return await fetch(input, {
            ...init,
            cache: "no-store",
            signal: init?.signal ?? AbortSignal.timeout(TIMEOUT_MS),
          });
        } catch (error) {
          transport.set(resource, networkDiagnostic(resource, error));
          throw error;
        }
      },
    },
  });
  const [s, c, t, initialProducts, b] = await Promise.all([
    db.from("store_settings").select("*").eq("id", 1).single(),
    db
      .from("categories")
      .select("id,name,slug,description,image_url,sort_order,active")
      .eq("active", true)
      .order("sort_order")
      .order("name"),
    db
      .from("product_types")
      .select("id,category_id,name,slug,description,sort_order,active")
      .eq("active", true)
      .order("sort_order")
      .order("name"),
    db
      .from("products")
      .select(GALLERY_PRODUCT_FIELDS)
      .eq("active", true)
      .order("sort_order")
      .order("name"),
    db.from("brands").select("id,name"),
  ]);
  const diagnostics: CatalogDiagnostic[] = [];
  type CompatibleProduct = Omit<
    Product,
    "brand_id" | "product_type_id" | "flavors"
  > &
    Partial<Pick<Product, "brand_id" | "product_type_id" | "flavors">>;
  let p: {
    data: CompatibleProduct[] | null;
    error: typeof initialProducts.error;
    status: number;
  } = initialProducts;

  /** Problema: tabelas auxiliares ou colunas novas ausentes derrubavam produtos
   * reais de instalações anteriores. O fallback só usa dados reais, respeita RLS
   * e registra a pendência de migração. Erros de recursos essenciais continuam 503.
   * Data: 2026-11-12. @author Carla Evelyn */
  if (p.error && ["42703", "PGRST204"].includes(p.error.code)) {
    diagnostics.push(queryDiagnostic("products", p.error, p.status));
    // Uma migração só de galeria pendente não deve apagar sabores/marcas/tipos
    // da resposta. O catálogo antigo continua navegável até aplicar o SQL.
    // Data: 2026-11-12. @author Carla Evelyn
    if (p.error.message.includes("image_urls")) {
      p = await db
        .from("products")
        .select(PRODUCT_FIELDS)
        .eq("active", true)
        .order("sort_order")
        .order("name");
    }
  }
  if (p.error && ["42703", "PGRST204"].includes(p.error.code)) {
    p = await db
      .from("products")
      .select(LEGACY_PRODUCT_FIELDS)
      .eq("active", true)
      .order("sort_order")
      .order("name");
  }
  const required = [
    ["store_settings", s],
    ["categories", c],
    ["products", p],
  ] as const;
  const failures = required.flatMap(([resource, result]) =>
    result.error
      ? [
          transport.get(resource) ||
            queryDiagnostic(resource, result.error, result.status),
        ]
      : [],
  );
  if (failures.length) throw new CatalogReadError(failures);
  for (const [resource, result] of [
    ["product_types", t],
    ["brands", b],
  ] as const) {
    if (result.error)
      diagnostics.push(
        transport.get(resource) ||
          queryDiagnostic(resource, result.error, result.status),
      );
  }
  const brandNames = new Map(
    (b.data || []).map((brand) => [brand.id, brand.name]),
  );
  return {
    settings: {
      ...s.data!,
      hero_image_urls: galleryImages(
        s.data!.hero_image_url,
        s.data!.hero_image_urls,
      ),
    },
    categories: c.data || [],
    productTypes: t.data || [],
    demo: false,
    diagnostics,
    products: (p.data || []).map((product): Product => ({
      ...product,
      image_urls: galleryImages(product.image_url, product.image_urls),
      image_url:
        galleryImages(product.image_url, product.image_urls)[0] || null,
      brand: brandNames.get(product.brand_id) ?? product.brand ?? null,
      brand_id: product.brand_id ?? null,
      product_type_id: product.product_type_id ?? null,
      price: product.price == null ? null : Number(product.price),
      promotional_price:
        product.promotional_price == null
          ? null
          : Number(product.promotional_price),
      flavors: Array.isArray(product.flavors) ? product.flavors : [],
    })),
  };
}
