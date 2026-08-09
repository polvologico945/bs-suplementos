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
  name: string;
  brand: string | null;
  description: string | null;
  price: number | null;
  promotional_price: number | null;
  image_url: string | null;
  active: boolean;
  featured: boolean;
  stock_status: "available" | "low" | "unavailable";
  sort_order: number;
  flavors: string[];
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
  primary_color: string;
  accent_color: string;
};

export type CartItem = Product & {
  quantity: number;
  flavor?: string;
};