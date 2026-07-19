import type { Category, Product, StoreSettings } from "./types";

export const demoSettings: StoreSettings = {
  id: 1,
  store_name: "BS Suplementos",
  tagline: "Performance, saúde e os melhores suplementos em Baturité.",
  whatsapp: "5585991665030",
  instagram: "@bio.suplementos",
  address: "Avenida Sete de Setembro, 848 — Centro — Baturité/CE",
  logo_url: "/brand/logo-card.jpg",
  hero_image_url: "/brand/card-front.jpg",
  primary_color: "#07883d",
  accent_color: "#c32222"
};

export const demoCategories: Category[] = [
  { id: "cat-1", name: "Bolinhos", slug: "bolinhos", description: "Opções práticas para o dia a dia.", image_url: null, sort_order: 1, active: true },
  { id: "cat-2", name: "Barrinhas", slug: "barrinhas", description: "Proteicas, energéticas e funcionais.", image_url: null, sort_order: 2, active: true },
  { id: "cat-3", name: "Suplementos", slug: "suplementos", description: "Diversas marcas, objetivos e tamanhos.", image_url: null, sort_order: 3, active: true },
  { id: "cat-4", name: "Pré-treino", slug: "pre-treino", description: "Energia e foco para o treino.", image_url: null, sort_order: 4, active: true }
];

export const demoProducts: Product[] = [
  { id: "p-1", category_id: "cat-1", name: "Bolinhos proteicos", brand: "Dr. Peanut", description: "Consulte sabores e disponibilidade.", price: null, promotional_price: null, image_url: null, active: true, featured: true, stock_status: "available", sort_order: 1 },
  { id: "p-2", category_id: "cat-2", name: "Barrinhas proteicas", brand: "Integralmédica", description: "Consulte sabores e disponibilidade.", price: null, promotional_price: null, image_url: null, active: true, featured: true, stock_status: "available", sort_order: 2 },
  { id: "p-3", category_id: "cat-2", name: "Barrinhas", brand: "Bendu", description: "Consulte sabores e disponibilidade.", price: null, promotional_price: null, image_url: null, active: true, featured: false, stock_status: "available", sort_order: 3 },
  { id: "p-4", category_id: "cat-3", name: "Suplementos — várias opções", brand: "Várias marcas", description: "Cadastre whey, creatina, vitaminas e outros itens pelo painel.", price: null, promotional_price: null, image_url: null, active: true, featured: true, stock_status: "available", sort_order: 4 },
  { id: "p-5", category_id: "cat-4", name: "Pré-treinos", brand: "Várias marcas", description: "Consulte opções e disponibilidade.", price: null, promotional_price: null, image_url: null, active: true, featured: true, stock_status: "available", sort_order: 5 }
];
