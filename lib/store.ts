import { createClient } from "./supabase/client";
import { demoCategories, demoProducts, demoSettings } from "./demo-data";
import type { Category, Product, StoreSettings } from "./types";

export async function loadCatalog(): Promise<{ settings: StoreSettings; categories: Category[]; products: Product[]; demo: boolean }> {
  const supabase = createClient();
  if (!supabase) return { settings: demoSettings, categories: demoCategories, products: demoProducts, demo: true };

  const [settingsRes, categoriesRes, productsRes] = await Promise.all([
    supabase.from("store_settings").select("*").eq("id", 1).single(),
    supabase.from("categories").select("*").eq("active", true).order("sort_order"),
    supabase.from("products").select("*").eq("active", true).order("sort_order")
  ]);

  if (settingsRes.error || categoriesRes.error || productsRes.error) {
    console.warn("Catálogo em modo demonstração:", settingsRes.error?.message || categoriesRes.error?.message || productsRes.error?.message);
    return { settings: demoSettings, categories: demoCategories, products: demoProducts, demo: true };
  }

  return {
    settings: settingsRes.data as StoreSettings,
    categories: categoriesRes.data as Category[],
    products: productsRes.data as Product[],
    demo: false
  };
}
