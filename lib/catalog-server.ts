import { createClient } from "@supabase/supabase-js";
import { demoCategories, demoProducts, demoSettings } from "./demo-data";
import type { Catalog, Product } from "./types";

export async function readPublicCatalog(): Promise<Catalog> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    if (process.env.VERCEL_ENV === "production")
      throw new Error("Supabase não configurado.");
    return {
      settings: demoSettings,
      categories: demoCategories,
      productTypes: [],
      products: demoProducts,
      demo: true,
    };
  }
  // Cliente anônimo sem cookies: somente respostas públicas podem ir ao CDN.
  const db = createClient(url, key, {
    db: { retry: false, timeout: 8_000 },
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          cache: "no-store",
          signal: init?.signal ?? AbortSignal.timeout(8_000),
        }),
    },
  });
  const [s, c, t, p, b] = await Promise.all([
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
      .select(
        "id,category_id,product_type_id,brand_id,name,brand,description,price,promotional_price,image_url,flavors,active,featured,stock_status,sort_order",
      )
      .eq("active", true)
      .order("sort_order")
      .order("name"),
    db.from("brands").select("id,name"),
  ]);
  if ([s, c, t, p, b].some((result) => result.error))
    throw new Error(
      "Falha ao consultar catálogo. Confira as migrações SQL e RLS.",
    );
  const brandNames = new Map(
    (b.data || []).map((brand) => [brand.id, brand.name]),
  );
  return {
    settings: s.data,
    categories: c.data || [],
    productTypes: t.data || [],
    demo: false,
    products: (p.data || []).map((product): Product => ({
      ...product,
      brand: brandNames.get(product.brand_id) ?? product.brand,
      price: product.price === null ? null : Number(product.price),
      promotional_price:
        product.promotional_price === null
          ? null
          : Number(product.promotional_price),
      flavors: Array.isArray(product.flavors) ? product.flavors : [],
    })),
  };
}
