"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Boxes,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  Minus,
  Package,
  Pencil,
  Plus,
  Save,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Category, Product, StoreSettings } from "@/lib/types";
import {
  sanitizeColor,
  sanitizeInstagram,
  sanitizeInteger,
  sanitizeNonNegativeNumber,
  sanitizeNullableText,
  sanitizePhone,
  sanitizeSlug,
  sanitizeText,
} from "@/lib/security/sanitize";

const blankProduct: Omit<Product, "id"> = {
  category_id: null,
  product_type_id: null,
  brand_id: null,
  name: "",
  brand: "",
  description: "",
  price: null,
  promotional_price: null,
  image_url: null,
  flavors: [],
  active: true,
  featured: false,
  stock_status: "available",
  sort_order: 0,
};

const blankCategory: Omit<Category, "id"> = {
  name: "",
  slug: "",
  description: "",
  image_url: null,
  sort_order: 0,
  active: true,
};

const blankProductType = {
  category_id: "",
  name: "",
  slug: "",
  description: "",
  sort_order: 0,
  active: true,
};

const blankBrand = {
  name: "",
  slug: "",
  description: "",
  sort_order: 0,
  active: true,
};
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg", "image/gif", "image/heic", "image/HEIC"]);

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export default function AdminDashboard() {
  const supabase = createClient();
  const [tab, setTab] = useState<
  "products" | "categories" | "product-types" | "brands" | "settings">("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productTypes, setProductTypes] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [productForm, setProductForm] = useState<any>(null);
  const [categoryForm, setCategoryForm] = useState<any>(null);
  const [productTypeForm, setProductTypeForm] = useState<any>(null);
  const [brandForm, setBrandForm] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  
  useEffect(() => {
    init();
  }, []);

  async function init() {
    if (!supabase) {
      location.href = "/admin/login";
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      location.href = "/admin/login";
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .single();
    if (profile?.role !== "admin") {
      await supabase.auth.signOut();
      location.href = "/admin/login";
      return;
    }
    await refresh();
    setReady(true);
  }

  async function refresh() {
    if (!supabase) return;
    const [p, c, t, b, s] = await Promise.all([
      supabase.from("products").select("*").order("sort_order"),
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("product_types").select("*").order("sort_order"),
      supabase.from("brands").select("*").order("sort_order"),
      supabase.from("store_settings").select("*").eq("id", 1).single(),
    ]);
    setProducts((p.data || []) as Product[]);
    setCategories((c.data || []) as Category[]);
    setProductTypes(t.data || []);
    setBrands(b.data || []);
    setSettings(s.data as StoreSettings);
  }

  async function upload(file: File, folder: string) {
    if (!supabase) return null;
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      throw new Error("Formato inválido. Use JPG, PNG, HEIC ou WEBP.");
    }

    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error("A imagem deve ter no máximo 5 MB.");
    }

    const extensionByMime: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/jpg": "jpg",
      "image/gif": "gif",
      "image/heic": "heic",
      "image/HEIC": "HEIC",
    };

    const ext = extensionByMime[file.type];
    const uniqueId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

    const path = `${folder}/${uniqueId}.${ext}`;
    const { error } = await supabase.storage
      .from("catalog")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    return supabase.storage.from("catalog").getPublicUrl(path).data.publicUrl;
  }

  async function saveProduct(e: FormEvent) {
    e.preventDefault();

    if (!supabase || !productForm) return;

    const data: any = {
      // Mantemos apenas os IDs para as relações com outras tabelas
      category_id: productForm.category_id || null,
      product_type_id: productForm.product_type_id || null,
      brand_id: productForm.brand_id || null,

      name: sanitizeText(productForm.name, { maxLength: 120 }),
      
      // REMOVIDO: a linha 'brand: ...' foi removida para evitar conflito com 'brand_id'
      
      description: sanitizeNullableText(productForm.description, {
        maxLength: 1500,
        multiline: true,
      }),

      price: sanitizeNonNegativeNumber(productForm.price, {
        nullable: true,
        max: 9999999,
      }),

      promotional_price: sanitizeNonNegativeNumber(productForm.promotional_price, {
        nullable: true,
        max: 9999999,
      }),

      flavors: Array.isArray(productForm.flavors)
        ? productForm.flavors
            .map((flavor: string) => sanitizeText(flavor, { maxLength: 80 }))
            .filter(Boolean)
        : [],

      image_url: typeof productForm.image_url === "string" ? productForm.image_url : null,
      active: Boolean(productForm.active),
      featured: Boolean(productForm.featured),
      stock_status: ["available", "low", "unavailable"].includes(productForm.stock_status)
        ? productForm.stock_status
        : "available",
      sort_order: sanitizeInteger(productForm.sort_order),
    };

    if (!data.name) {
      setMessage("Informe um nome válido para o produto.");
      return;
    }

    
    if (data.brand_id) {
      const selectedBrand = brands.find(b => b.id === data.brand_id);
      if (selectedBrand) data.brand = selectedBrand.name;
    }

    const result = productForm.id
      ? await supabase.from("products").update(data).eq("id", productForm.id)
      : await supabase.from("products").insert(data);

    if (result.error) {
      setMessage("Erro ao salvar: " + result.error.message);
    } else {
      setMessage("Produto salvo com sucesso!");
      setProductForm(null);
      await refresh();
    }
  }

  async function saveCategory(e: FormEvent) {
    e.preventDefault();

    if (!supabase || !categoryForm) return;

    const name = sanitizeText(categoryForm.name, {
      maxLength: 80,
    });

    const data = {
      name,

      slug: sanitizeSlug(categoryForm.slug || name),

      description: sanitizeNullableText(categoryForm.description, {
        maxLength: 600,
        multiline: true,
      }),

      image_url:
        typeof categoryForm.image_url === "string"
          ? categoryForm.image_url
          : null,

      sort_order: sanitizeInteger(categoryForm.sort_order),

      active: Boolean(categoryForm.active),
    };

    if (!data.name || !data.slug) {
      setMessage("Informe um nome válido para a categoria.");
      return;
    }

    const result = categoryForm.id
      ? await supabase.from("categories").update(data).eq("id", categoryForm.id)
      : await supabase.from("categories").insert(data);

    setMessage(result.error ? result.error.message : "Categoria salva.");

    if (!result.error) {
      setCategoryForm(null);
      await refresh();
    }
  }

  async function saveProductType(e: FormEvent) {
    e.preventDefault();

    if (!supabase || !productTypeForm) return;

    const name = sanitizeText(productTypeForm.name, {
      maxLength: 80,
    });

    const data = {
      category_id: productTypeForm.category_id || null,

      name,

      slug: sanitizeSlug(productTypeForm.slug || name),

      description: sanitizeNullableText(productTypeForm.description, {
        maxLength: 600,
        multiline: true,
      }),

      sort_order: sanitizeInteger(productTypeForm.sort_order),

      active: Boolean(productTypeForm.active),
    };

    if (!data.name || !data.category_id || !data.slug) {
      setMessage("Informe a categoria e um nome válido para o tipo.");
      return;
    }

    const result = productTypeForm.id
      ? await supabase
          .from("product_types")
          .update(data)
          .eq("id", productTypeForm.id)
      : await supabase
          .from("product_types")
          .insert(data);

    setMessage(
      result.error
        ? result.error.message
        : "Tipo de produto salvo."
    );

    if (!result.error) {
      setProductTypeForm(null);
      await refresh();
    }
  }

  async function saveBrand(e: FormEvent) {
    e.preventDefault();

    if (!supabase || !brandForm) return;

    const name = sanitizeText(brandForm.name, {
      maxLength: 80,
    });

    const data = {
      name,

      slug: sanitizeSlug(brandForm.slug || name),

      description: sanitizeNullableText(brandForm.description, {
        maxLength: 600,
        multiline: true,
      }),

      sort_order: sanitizeInteger(brandForm.sort_order),

      active: Boolean(brandForm.active),
    };

    if (!data.name || !data.slug) {
      setMessage("Informe um nome válido para a marca.");
      return;
    }

    const result = brandForm.id
      ? await supabase
          .from("brands")
          .update(data)
          .eq("id", brandForm.id)
      : await supabase
          .from("brands")
          .insert(data);

    setMessage(
      result.error
        ? result.error.message
        : "Marca salva."
    );

    if (!result.error) {
      setBrandForm(null);
      await refresh();
    }
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault();

    if (!supabase || !settings) return;

    const safeSettings = {
      store_name: sanitizeText(settings.store_name, {
        maxLength: 100,
      }),

      tagline: sanitizeText(settings.tagline, {
        maxLength: 180,
      }),

      whatsapp: sanitizePhone(settings.whatsapp),

      instagram: sanitizeInstagram(settings.instagram),

      address: sanitizeNullableText(settings.address, {
        maxLength: 300,
      }),

      logo_url: settings.logo_url,
      hero_image_url: settings.hero_image_url,

      primary_color: sanitizeColor(settings.primary_color, "#16a34a"),

      accent_color: sanitizeColor(settings.accent_color, "#22c55e"),
    };

    const { error } = await supabase
      .from("store_settings")
      .update(safeSettings)
      .eq("id", 1);

    if (!error) {
      setSettings({
        ...settings,
        ...safeSettings,
      });
    }

    setMessage(error ? error.message : "Configurações salvas.");
  }

  async function remove(table: "products" | "categories" | "product_types" | "brands", id: string) {
    if (!supabase || !confirm("Tem certeza que deseja remover?")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    setMessage(error ? error.message : "Item removido.");
    await refresh();
  }

  if (!ready) return <div className="loading">Validando acesso…</div>;
  const filteredProducts =
    categoryFilter === "all"
      ? products
      : products.filter((p) => p.category_id === categoryFilter);
      
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <img src={settings?.logo_url || "/brand/logo-card.jpg"} alt="" />
          <div>
            <strong>BS Suplementos</strong>
            <span>Administração</span>
          </div>
        </div>
        
        <nav>
          <button
            className={tab === "products" ? "active" : ""}
            onClick={() => setTab("products")}
          >
            <Package /> Produtos
          </button>
          
          <button
            className={tab === "categories" ? "active" : ""}
            onClick={() => setTab("categories")}
          >
            <Boxes /> Categorias
          </button>

          {/* Mova estes para fora do botão de settings */}
          <button
            className={tab === "product-types" ? "active" : ""}
            onClick={() => setTab("product-types")}
          >
            <Boxes /> Tipos de produto
          </button>

          <button
            className={tab === "brands" ? "active" : ""}
            onClick={() => setTab("brands")}
          >
            <Boxes /> Marcas
          </button>

          <button
            className={tab === "settings" ? "active" : ""}
            onClick={() => setTab("settings")}
          >
            <Settings /> Aparência e loja
          </button>
        </nav>

        <div className="admin-sidebar-bottom">
          <a href="/" target="_blank">
            <LayoutDashboard /> Ver catálogo
          </a>
          <button
            onClick={async () => {
              await supabase?.auth.signOut();
              location.href = "/admin/login";
            }}
          >
            <LogOut /> Sair
          </button>
        </div>
      </aside>

      <section className="admin-content">
        <header>
          <div>
            <span>PAINEL ADMINISTRATIVO</span>
            <h1>
              {tab === "products"
                ? "Produtos"
                : tab === "categories"
                  ? "Categorias"
                  : tab === "product-types"
                    ? "Tipos de produto"
                    : tab === "brands"
                      ? "Marcas"
                      : "Aparência e informações"}
            </h1>
          </div>
          {tab === "products" && (
            <div className="admin-header-actions">

              <div className="category-filter-wrapper">
                <button
                  className="admin-primary"
                  onClick={() => setCategoryMenuOpen(!categoryMenuOpen)}
                >
                  <Boxes />

                  {categoryFilter === "all"
                    ? "Todos"
                    : categories.find((c) => c.id === categoryFilter)?.name}
                </button>

                {categoryMenuOpen && (
                  <div className="category-dropdown">
                    <button
                      onClick={() => {
                        setCategoryFilter("all");
                        setCategoryMenuOpen(false);
                      }}
                    >
                      Todas
                    </button>

                    {categories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setCategoryFilter(c.id);
                          setCategoryMenuOpen(false);
                        }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                className="admin-primary"
                onClick={() => setProductForm({ ...blankProduct })}
              >
                <Plus /> Novo produto
              </button>

            </div>
          )}
          {tab === "categories" && (
            <button
              className="admin-primary"
              onClick={() => setCategoryForm({ ...blankCategory })}
            >
              <Plus /> Nova categoria
            </button>
          )}
          {tab === "product-types" && (
            <button
              className="admin-primary"
              onClick={() =>
                setProductTypeForm({ ...blankProductType })
              }
            >
              <Plus /> Novo tipo
            </button>
          )}

          {tab === "brands" && (
            <button
              className="admin-primary"
              onClick={() =>
                setBrandForm({ ...blankBrand })
              }
            >
              <Plus /> Nova marca
            </button>
          )}
        </header>
        {message && (
          <div className="admin-message" onClick={() => setMessage("")}>
            {message}
            <X size={16} />
          </div>
        )}

        {tab === "products" && (
          <>

            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Categoria</th>
                    <th>Preço</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="table-product">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} />
                          ) : (
                            <div className="mini-placeholder">
                              <Package />
                            </div>
                          )}

                          <div>
                            <strong>{p.name}</strong>
                            <span>{p.brand || "Sem marca"}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        {categories.find((c) => c.id === p.category_id)?.name ||
                          "Sem categoria"}
                      </td>

                      <td>
                        {p.promotional_price || p.price ? (
                          `R$ ${Number(p.promotional_price ?? p.price)
                            .toFixed(2)
                            .replace(".", ",")}`
                        ) : (
                          "Sob consulta"
                        )}
                      </td>

                      <td>
                        <span className={`status ${p.active ? "on" : "off"}`}>
                          {p.active ? "Visível" : "Oculto"}
                        </span>
                      </td>

                      <td className="actions">
                        <button onClick={() => setProductForm({ ...p })}>
                          <Pencil />
                        </button>

                        <button onClick={() => remove("products", p.id)}>
                          <Trash2 />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        Nenhum produto encontrado nessa categoria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "categories" && (
          <div className="admin-cards">
            {categories.map((c) => (
              <article key={c.id}>
                <div className="category-icon">
                  <Boxes />
                </div>
                <div>
                  <strong>{c.name}</strong>
                  <p>{c.description || "Sem descrição"}</p>
                  <span>
                    {products.filter((p) => p.category_id === c.id).length}{" "}
                    produto(s)
                  </span>
                </div>
                <div className="actions">
                  <button onClick={() => setCategoryForm({ ...c })}>
                    <Pencil />
                  </button>
                  <button onClick={() => remove("categories", c.id)}>
                    <Trash2 />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {tab === "product-types" && (
          <div className="admin-cards">
            {productTypes.map((type) => (
              <article key={type.id}>
                <div className="category-icon">
                  <Boxes />
                </div>

                <div>
                  <strong>{type.name}</strong>

                  <p>
                    {categories.find(
                      (c) => c.id === type.category_id
                    )?.name || "Sem categoria"}
                  </p>

                  <span>
                    {type.description || "Sem descrição"}
                  </span>
                </div>

                <div className="actions">
                  <button
                    onClick={() =>
                      setProductTypeForm({ ...type })
                    }
                  >
                    <Pencil />
                  </button>

                  <button
                    onClick={() =>
                      remove("product_types" as any, type.id)
                    }
                  >
                    <Trash2 />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {tab === "brands" && (
          <div className="admin-cards">
            {brands.map((brand) => (
              <article key={brand.id}>
                <div className="category-icon">
                  <Boxes />
                </div>

                <div>
                  <strong>{brand.name}</strong>
                  <p>{brand.description || "Sem descrição"}</p>
                </div>

                <div className="actions">
                  <button
                    onClick={() =>
                      setBrandForm({ ...brand })
                    }
                  >
                    <Pencil />
                  </button>

                  <button
                    onClick={() =>
                      remove("brands" as any, brand.id)
                    }
                  >
                    <Trash2 />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}



        {tab === "settings" && settings && (
          <form className="settings-form" onSubmit={saveSettings}>
            <div className="form-section">
              <h2>Identidade da loja</h2>
              <div className="form-grid">
                <label>
                  Nome da loja
                  <input
                    value={settings.store_name}
                    onChange={(e) =>
                      setSettings({ ...settings, store_name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Frase principal
                  <input
                    value={settings.tagline}
                    onChange={(e) =>
                      setSettings({ ...settings, tagline: e.target.value })
                    }
                  />
                </label>
              </div>
            </div>
            <div className="form-section">
              <h2>Imagens do site</h2>
              <div className="upload-grid">
                <label className="upload-box">
                  <ImagePlus />
                  <strong>Alterar logotipo</strong>
                  <span>PNG, JPG ou WEBP</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f)
                        setSettings({
                          ...settings,
                          logo_url: await upload(f, "branding"),
                        });
                    }}
                  />
                </label>
                <label className="upload-box">
                  <ImagePlus />
                  <strong>Alterar imagem de capa</strong>
                  <span>Imagem horizontal recomendada</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f)
                        setSettings({
                          ...settings,
                          hero_image_url: await upload(f, "branding"),
                        });
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="form-section">
              <h2>Contato</h2>
              <div className="form-grid">
                <label>
                  WhatsApp com DDI
                  <input
                    value={settings.whatsapp}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        whatsapp: e.target.value.replace(/\D/g, ""),
                      })
                    }
                  />
                </label>
                <label>
                  Instagram
                  <input
                    value={settings.instagram || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, instagram: e.target.value })
                    }
                  />
                </label>
                <label className="wide">
                  Endereço
                  <input
                    value={settings.address || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, address: e.target.value })
                    }
                  />
                </label>
              </div>
            </div>
            <button className="admin-primary save">
              <Save /> Salvar configurações
            </button>
          </form>
        )}
      </section>

      {productForm && (
        <div className="modal-backdrop">
          <form className="admin-modal" onSubmit={saveProduct}>
            <div className="modal-title">
              <div>
                <span>CATÁLOGO</span>
                <h2>{productForm.id ? "Editar produto" : "Novo produto"}</h2>
              </div>
              <button type="button" onClick={() => setProductForm(null)}>
                <X />
              </button>
            </div>
            <div className="form-grid">
              <label className="wide">
                Nome
                <input
                  required
                  value={productForm.name}
                  onChange={(e) =>
                    setProductForm({ ...productForm, name: e.target.value })
                  }
                />
              </label>
              <label>
                Categoria
                <select
                  value={productForm.category_id || ""}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      category_id: e.target.value || null,
                    })
                  }
                >
                  <option value="">Sem categoria</option>
                  {categories.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tipo de produto
                <select
                  value={productForm.product_type_id || ""}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      product_type_id: e.target.value || null,
                    })
                  }
                >
                  <option value="">Selecione o tipo</option>

                  {productTypes
                    .filter(
                      (type) => !productForm.category_id ||
                        type.category_id === productForm.category_id
                    )
                    .map((type) => (
                      <option value={type.id} key={type.id}>
                        {type.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Marca
                <select
                  value={productForm.brand_id || ""}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      brand_id: e.target.value || null,
                    })
                  }
                >
                  <option value="">Selecione a marca</option>

                  {brands.map((brand) => (
                    <option value={brand.id} key={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Preço
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.price ?? ""}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      price: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </label>
              <label>
                Preço promocional
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.promotional_price ?? ""}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      promotional_price: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
              </label>
              <label className="wide">
                Descrição
                <textarea
                  value={productForm.description || ""}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      description: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Status do estoque
                <select
                  value={productForm.stock_status}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      stock_status: e.target.value,
                    })
                  }
                >
                  <option value="available">Disponível</option>
                  <option value="low">Estoque baixo</option>
                  <option value="unavailable">Indisponível</option>
                </select>
              </label>
              <label>
                Ordem de exibição
                <input
                  type="number"
                  value={productForm.sort_order}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      sort_order: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={productForm.active}
                  onChange={(e) =>
                    setProductForm({ ...productForm, active: e.target.checked })
                  }
                />{" "}
                Visível no catálogo
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={productForm.featured}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      featured: e.target.checked,
                    })
                  }
                />{" "}
                Marcar como destaque
              </label>
              <div className="wide product-flavors">
                <div className="flavors-header">
                  <div>
                    <strong>Sabores</strong>
                    <span>
                      Adicione os sabores disponíveis para este produto.
                    </span>
                  </div>

                  <button
                    type="button"
                    className="add-flavor"
                    onClick={() =>
                      setProductForm({
                        ...productForm,
                        flavors: [...(productForm.flavors || []), ""],
                      })
                    }
                  >
                    <Plus size={16} />
                    Adicionar sabor
                  </button>
                </div>

                <div className="flavors-list">
                  {(productForm.flavors || []).map(
                    (flavor: string, index: number) => (
                      <div className="flavor-row" key={index}>
                        <input
                          value={flavor}
                          placeholder={`Sabor ${index + 1}`}
                          onChange={(e) => {
                            const flavors = [...(productForm.flavors || [])];
                            flavors[index] = e.target.value;

                            setProductForm({
                              ...productForm,
                              flavors,
                            });
                          }}
                        />

                        <button
                          type="button"
                          className="remove-flavor"
                          aria-label="Remover sabor"
                          onClick={() => {
                            const flavors = [...(productForm.flavors || [])];
                            flavors.splice(index, 1);

                            setProductForm({
                              ...productForm,
                              flavors,
                            });
                          }}
                        >
                          <Minus size={16} />
                        </button>
                      </div>
                    )
                  )}

                  {(!productForm.flavors ||
                    productForm.flavors.length === 0) && (
                    <p className="no-flavors">
                      Nenhum sabor cadastrado. Se o produto não tiver sabor,
                      deixe esta lista vazia.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <label className="upload-box compact">
              <ImagePlus />
              <strong>Foto do produto</strong>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f)
                    setProductForm({
                      ...productForm,
                      image_url: await upload(f, "products"),
                    });
                }}
              />
            </label>
            {productForm.image_url && (
              <img
                className="form-preview"
                src={productForm.image_url}
                alt="Prévia"
              />
            )}
            <button className="admin-primary save">
              <Save /> Salvar produto
            </button>
          </form>
        </div>
      )}

      {productTypeForm && (
        <div className="modal-backdrop">
          <form
            className="admin-modal small"
            onSubmit={saveProductType}
          >
            <div className="modal-title">
              <div>
                <span>ORGANIZAÇÃO</span>
                <h2>
                  {productTypeForm.id
                    ? "Editar tipo de produto"
                    : "Novo tipo de produto"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setProductTypeForm(null)}
              >
                <X />
              </button>
            </div>

            <div className="form-grid">
              <label className="wide">
                Categoria

                <select
                  required
                  value={productTypeForm.category_id}
                  onChange={(e) =>
                    setProductTypeForm({
                      ...productTypeForm,
                      category_id: e.target.value,
                    })
                  }
                >
                  <option value="">
                    Selecione uma categoria
                  </option>

                  {categories.map((category) => (
                    <option
                      value={category.id}
                      key={category.id}
                    >
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="wide">
                Nome

                <input
                  required
                  value={productTypeForm.name}
                  onChange={(e) =>
                    setProductTypeForm({
                      ...productTypeForm,
                      name: e.target.value,
                    })
                  }
                />
              </label>

              <label className="wide">
                Descrição

                <textarea
                  value={productTypeForm.description || ""}
                  onChange={(e) =>
                    setProductTypeForm({
                      ...productTypeForm,
                      description: e.target.value,
                    })
                  }
                />
              </label>
            </div>

            <button className="admin-primary save">
              <Save /> Salvar tipo
            </button>
          </form>
        </div>
      )}

      {brandForm && (
        <div className="modal-backdrop">
          <form
            className="admin-modal small"
            onSubmit={saveBrand}
          >
            <div className="modal-title">
              <div>
                <span>ORGANIZAÇÃO</span>
                <h2>
                  {brandForm.id
                    ? "Editar marca"
                    : "Nova marca"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setBrandForm(null)}
              >
                <X />
              </button>
            </div>

            <div className="form-grid">
              <label className="wide">
                Nome

                <input
                  required
                  value={brandForm.name}
                  onChange={(e) =>
                    setBrandForm({
                      ...brandForm,
                      name: e.target.value,
                    })
                  }
                />
              </label>

              <label className="wide">
                Descrição

                <textarea
                  value={brandForm.description || ""}
                  onChange={(e) =>
                    setBrandForm({
                      ...brandForm,
                      description: e.target.value,
                    })
                  }
                />
              </label>
            </div>

            <button className="admin-primary save">
              <Save /> Salvar marca
            </button>
          </form>
        </div>
      )}

      {categoryForm && (
        <div className="modal-backdrop">
          <form className="admin-modal small" onSubmit={saveCategory}>
            <div className="modal-title">
              <div>
                <span>ORGANIZAÇÃO</span>
                <h2>
                  {categoryForm.id ? "Editar categoria" : "Nova categoria"}
                </h2>
              </div>
              <button type="button" onClick={() => setCategoryForm(null)}>
                <X />
              </button>
            </div>
            <div className="form-grid">
              <label className="wide">
                Nome
                <input
                  required
                  value={categoryForm.name}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, name: e.target.value })
                  }
                />
              </label>
              <label className="wide">
                Descrição
                <textarea
                  value={categoryForm.description || ""}
                  onChange={(e) =>
                    setCategoryForm({
                      ...categoryForm,
                      description: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Ordem
                <input
                  type="number"
                  value={categoryForm.sort_order}
                  onChange={(e) =>
                    setCategoryForm({
                      ...categoryForm,
                      sort_order: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={categoryForm.active}
                  onChange={(e) =>
                    setCategoryForm({
                      ...categoryForm,
                      active: e.target.checked,
                    })
                  }
                />{" "}
                Visível
              </label>
            </div>
            <button className="admin-primary save">
              <Save /> Salvar categoria
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
