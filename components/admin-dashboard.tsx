"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Boxes,
  ImagePlus,
  LayoutDashboard,
  LogOut,
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
  description: "",
  price: null,
  promotional_price: null,
  image_url: null,
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
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export default function AdminDashboard() {
  const supabase = createClient();
  const [tab, setTab] = useState<"products" | "categories" | "settings">(
    "products",
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productTypes, setProductTypes] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [productForm, setProductForm] = useState<any>(null);
  const [categoryForm, setCategoryForm] = useState<any>(null);
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
      throw new Error("Formato inválido. Use JPG, PNG ou WEBP.");
    }

    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error("A imagem deve ter no máximo 5 MB.");
    }

    const extensionByMime: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
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

    const data = {
      category_id:
        typeof productForm.category_id === "string" && productForm.category_id
          ? productForm.category_id
          : null,

      product_type_id:
        typeof productForm.product_type_id === "string" &&
        productForm.product_type_id
          ? productForm.product_type_id
          : null,

      brand_id:
        typeof productForm.brand_id === "string" && productForm.brand_id
          ? productForm.brand_id
          : null,

      name: sanitizeText(productForm.name, {
        maxLength: 120,
      }),

      brand: sanitizeNullableText(productForm.brand, {
        maxLength: 80,
      }),

      description: sanitizeNullableText(productForm.description, {
        maxLength: 1500,
        multiline: true,
      }),

      price: sanitizeNonNegativeNumber(productForm.price, {
        nullable: true,
        max: 9999999,
      }),

      promotional_price: sanitizeNonNegativeNumber(
        productForm.promotional_price,
        {
          nullable: true,
          max: 9999999,
        },
      ),

      image_url:
        typeof productForm.image_url === "string"
          ? productForm.image_url
          : null,

      active: Boolean(productForm.active),
      featured: Boolean(productForm.featured),

      stock_status: ["available", "low", "unavailable"].includes(
        productForm.stock_status,
      )
        ? productForm.stock_status
        : "available",

      sort_order: sanitizeInteger(productForm.sort_order),
    };

    if (!data.name) {
      setMessage("Informe um nome válido para o produto.");
      return;
    }

    if (
      data.promotional_price !== null &&
      data.price !== null &&
      data.promotional_price > data.price
    ) {
      setMessage("O preço promocional não pode ser maior que o preço normal.");
      return;
    }

    const result = productForm.id
      ? await supabase.from("products").update(data).eq("id", productForm.id)
      : await supabase.from("products").insert(data);

    setMessage(result.error ? result.error.message : "Produto salvo.");

    if (!result.error) {
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

  async function remove(table: "products" | "categories", id: string) {
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
                  : "Aparência e informações"}
            </h1>
          </div>
          {tab === "products" && (
            <div className="admin-header-actions">
              <button
                className="admin-primary"
                onClick={() => setCategoryMenuOpen(!categoryMenuOpen)}
              >
                <Boxes />

                {categoryFilter === "all"
                  ? "Todas"
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
                Marca
                <input
                  value={productForm.brand || ""}
                  onChange={(e) =>
                    setProductForm({ ...productForm, brand: e.target.value })
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
