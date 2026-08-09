import { createClient } from "./supabase/client";
import {
  demoCategories,
  demoProducts,
  demoSettings,
} from "./demo-data";

import type {
  Category,
  Product,
  ProductType,
  StoreSettings,
} from "./types";

export async function loadCatalog(): Promise<{
  settings: StoreSettings;
  categories: Category[];
  productTypes: ProductType[];
  products: Product[];
  demo: boolean;
}> {
  const supabase = createClient();

  if (!supabase) {
    return {
      settings: demoSettings,
      categories: demoCategories,
      productTypes: [],
      products: demoProducts,
      demo: true,
    };
  }

  const [
    settingsRes,
    categoriesRes,
    productTypesRes,
    productsRes,
  ] = await Promise.all([
    supabase
      .from("store_settings")
      .select("*")
      .eq("id", 1)
      .single(),

    supabase
      .from("categories")
      .select("*")
      .eq("active", true)
      .order("sort_order"),

    supabase
      .from("product_types")
      .select("*")
      .eq("active", true)
      .order("sort_order"),

    supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .order("sort_order"),
  ]);

  if (
    settingsRes.error ||
    categoriesRes.error ||
    productTypesRes.error ||
    productsRes.error
  ) {
    console.warn(
      "Catálogo em modo demonstração:",
      settingsRes.error?.message ||
        categoriesRes.error?.message ||
        productTypesRes.error?.message ||
        productsRes.error?.message,
    );

    return {
      settings: demoSettings,
      categories: demoCategories,
      productTypes: [],
      products: demoProducts,
      demo: true,
    };
  }

  return {
    settings: settingsRes.data as StoreSettings,
    categories: categoriesRes.data as Category[],
    productTypes: productTypesRes.data as ProductType[],
    products: productsRes.data as Product[],
    demo: false,
  };
}