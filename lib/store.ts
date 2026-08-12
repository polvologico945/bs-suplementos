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
  console.log("1. Iniciando loadCatalog");

  const supabase = createClient();

  console.log("2. Supabase:", supabase);

  if (!supabase) {
    console.log("3. Sem Supabase → modo demo");

    return {
      settings: demoSettings,
      categories: demoCategories,
      productTypes: [],
      products: demoProducts,
      demo: true,
    };
  }

  console.log("4. Consultando Supabase...");

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

  console.log("5. Resultado Supabase:", {
    settingsRes,
    categoriesRes,
    productTypesRes,
    productsRes,
  });

  console.log(
  "7. Produtos recebidos:",
  productsRes.data
);

console.log(
  "8. Sabores recebidos:",
  productsRes.data?.map((product) => ({
    id: product.id,
    name: product.name,
    flavors: product.flavors,
  }))
);

  if (settingsRes.error) {
    console.error(
      "Erro em store_settings:",
      settingsRes.error
    );
  }

  if (categoriesRes.error) {
    console.error(
      "Erro em categories:",
      categoriesRes.error
    );
  }

  if (productTypesRes.error) {
    console.error(
      "Erro em product_types:",
      productTypesRes.error
    );
  }

  if (productsRes.error) {
    console.error(
      "Erro em products:",
      productsRes.error
    );
  }

  /*
   * Se product_types falhar,
   * não derrubamos o catálogo inteiro.
   */

  if (
    settingsRes.error ||
    categoriesRes.error ||
    productsRes.error
  ) {
    console.warn(
      "Erro crítico ao carregar catálogo. Usando modo demo."
    );

    return {
      settings: demoSettings,
      categories: demoCategories,
      productTypes: [],
      products: demoProducts,
      demo: true,
    };
  }

  console.log("6. Catálogo carregado com sucesso");

  return {
    settings: settingsRes.data as StoreSettings,
    categories: categoriesRes.data as Category[],
    productTypes: productTypesRes.error
      ? []
      : (productTypesRes.data as ProductType[]),
    products: productsRes.data as Product[],
    demo: false,
  };
}