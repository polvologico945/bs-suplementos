export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  active: boolean;
};

export type ProductType = {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  active: boolean;
};

export type Product = {
  id: string;
  category_id: string | null;
  product_type_id: string | null;
  brand_id: string | null;
  name: string;
  brand: string | null;
  description: string | null;
  price: number | null;
  promotional_price: number | null;
  image_url: string | null;
  image_urls?: string[];
  flavors: string[];
  active: boolean;
  featured: boolean;
  stock_status: "available" | "low" | "unavailable";
  sort_order: number;
};

export type StoreSettings = {
  id: number;
  store_name: string;
  tagline: string;
  whatsapp: string;
  instagram: string | null;
  address: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  hero_image_urls?: string[];
  primary_color: string;
  accent_color: string;
};

export type Brand = Omit<ProductType, "category_id">;
export type EditForm<T extends { id: string }> = Omit<T, "id"> & {
  id?: string;
};

export type CartEntry = {
  id: string;
  quantity: number;
  flavor: string | null;
};

export type CartItem = Product & CartEntry;
export type Catalog = {
  settings: StoreSettings;
  categories: Category[];
  productTypes: ProductType[];
  products: Product[];
  demo: boolean;
};
