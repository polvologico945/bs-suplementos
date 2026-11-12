"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Boxes,
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
import { CatalogImage } from "@/components/catalog-image";
import { ImageUpload } from "@/components/admin/image-upload";
import { ImageGalleryUpload } from "@/components/admin/image-gallery-upload";
import { galleryImages } from "@/lib/images/gallery";
import { ProductEditor } from "@/components/admin/product-editor";
import { TaxonomyEditor } from "@/components/admin/taxonomy-editor";
import type {
  Brand,
  Category,
  Product,
  ProductType,
  StoreSettings,
  EditForm,
} from "@/lib/types";
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
  image_urls: [],
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
export default function AdminDashboard() {
  const supabase = createClient();
  const [tab, setTab] = useState<
    "products" | "categories" | "product-types" | "brands" | "settings"
  >("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [productForm, setProductForm] = useState<EditForm<Product> | null>(
    null,
  );
  const [categoryForm, setCategoryForm] = useState<EditForm<Category> | null>(
    null,
  );
  const [productTypeForm, setProductTypeForm] =
    useState<EditForm<ProductType> | null>(null);
  const [brandForm, setBrandForm] = useState<EditForm<Brand> | null>(null);
  const [message, setMessage] = useState("");
  const [uploadCount, setUploadCount] = useState(0);
  const onUploadBusy = useCallback(
    (busy: boolean) =>
      setUploadCount((count) => Math.max(0, count + (busy ? 1 : -1))),
    [],
  );
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const galleriesReady = Array.isArray(settings?.hero_image_urls);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        if (!supabase) {
          window.location.assign(
            new URL("/admin/login", window.location.origin),
          );
          return;
        }
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
          window.location.assign(
            new URL("/admin/login", window.location.origin),
          );
          return;
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", auth.user.id)
          .single();
        if (profile?.role !== "admin") {
          await supabase.auth.signOut();
          window.location.assign(
            new URL("/admin/login", window.location.origin),
          );
          return;
        }
        await refresh();
        if (active) setReady(true);
      } catch {
        if (active)
          setLoadError(
            "Não foi possível carregar o painel. Confira a conexão e execute a migração SQL desta versão.",
          );
      }
    }
    void init();
    return () => {
      active = false;
    };
    // Cliente singleton e carga inicial: o painel recarrega somente após alterações.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    if (!supabase) return;
    const [p, c, t, b, s] = await Promise.all([
      supabase.from("products").select("*").order("sort_order"),
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("product_types").select("*").order("sort_order"),
      supabase.from("brands").select("*").order("sort_order"),
      supabase.from("store_settings").select("*").eq("id", 1).single(),
    ]);
    if ([p, c, t, b, s].some((result) => result.error))
      throw new Error("Falha ao carregar os dados do painel.");
    setProducts((p.data || []) as Product[]);
    setCategories((c.data || []) as Category[]);
    setProductTypes(t.data || []);
    setBrands(b.data || []);
    setSettings(s.data as StoreSettings);
  }

  async function saveProduct(e: FormEvent) {
    e.preventDefault();

    if (!supabase || !productForm) return;

    const data: Omit<Product, "id"> = {
      category_id: productForm.category_id || null,
      product_type_id: productForm.product_type_id || null,
      brand_id: productForm.brand_id || null,

      name: sanitizeText(productForm.name, { maxLength: 120 }),

      brand:
        brands.find((brand) => brand.id === productForm.brand_id)?.name || null,
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

      flavors: [
        ...new Set(
          productForm.flavors
            .map((flavor) => sanitizeText(flavor, { maxLength: 80 }))
            .filter(Boolean),
        ),
      ],

      image_url:
        galleryImages(productForm.image_url, productForm.image_urls)[0] || null,
      ...(galleriesReady
        ? {
            image_urls: galleryImages(
              productForm.image_url,
              productForm.image_urls,
            ),
          }
        : {}),
      active: Boolean(productForm.active),
      featured: Boolean(productForm.featured),
      stock_status: productForm.stock_status,
      sort_order: sanitizeInteger(productForm.sort_order),
    };

    if (
      data.promotional_price !== null &&
      (data.price === null || data.promotional_price >= data.price)
    ) {
      setMessage("O preço promocional deve ser menor que o preço normal.");
      return;
    }
    if (!data.name) {
      setMessage("Informe um nome válido para o produto.");
      return;
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
      : await supabase.from("product_types").insert(data);

    setMessage(result.error ? result.error.message : "Tipo de produto salvo.");

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
      ? await supabase.from("brands").update(data).eq("id", brandForm.id)
      : await supabase.from("brands").insert(data);

    setMessage(result.error ? result.error.message : "Marca salva.");

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
      hero_image_url:
        galleryImages(settings.hero_image_url, settings.hero_image_urls)[0] ||
        null,
      ...(galleriesReady
        ? {
            hero_image_urls: galleryImages(
              settings.hero_image_url,
              settings.hero_image_urls,
            ),
          }
        : {}),

      primary_color: sanitizeColor(settings.primary_color, "#16a34a"),

      accent_color: sanitizeColor(settings.accent_color, "#22c55e"),
    };

    if (!safeSettings.store_name || safeSettings.whatsapp.length < 10) {
      setMessage("Informe o nome da loja e um WhatsApp válido com DDI.");
      return;
    }
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

  async function submit(
    event: FormEvent,
    action: (event: FormEvent) => Promise<void>,
  ) {
    event.preventDefault();
    if (saving || uploadCount > 0) return;
    setSaving(true);
    try {
      await action(event);
    } catch {
      setMessage(
        "Não foi possível concluir a operação. Verifique a conexão e tente novamente.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(
    table: "products" | "categories" | "product_types" | "brands",
    id: string,
  ) {
    if (
      !supabase ||
      saving ||
      uploadCount > 0 ||
      !confirm("Tem certeza que deseja remover?")
    )
      return;
    setSaving(true);
    try {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      setMessage("Item removido.");
      await refresh();
    } catch {
      setMessage(
        "Não foi possível remover o item. Verifique os vínculos e sua conexão.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loadError)
    return (
      <main className="loading">
        <div role="alert">
          <p>{loadError}</p>
          <button onClick={() => location.reload()}>Tentar novamente</button>
        </div>
      </main>
    );
  if (!ready) return <div className="loading">Validando acesso…</div>;
  const filteredProducts =
    categoryFilter === "all"
      ? products
      : products.filter((p) => p.category_id === categoryFilter);

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <CatalogImage
            src={settings?.logo_url || "/brand/logo-card.jpg"}
            alt=""
          />
          <div>
            <strong>BS Suplementos</strong>
            <span>Administração</span>
          </div>
        </div>

        <nav>
          <button
            className={tab === "products" ? "active" : ""}
            aria-current={tab === "products" ? "page" : undefined}
            disabled={saving || uploadCount > 0}
            onClick={() => setTab("products")}
          >
            <Package /> Produtos
          </button>

          <button
            className={tab === "categories" ? "active" : ""}
            aria-current={tab === "categories" ? "page" : undefined}
            disabled={saving || uploadCount > 0}
            onClick={() => setTab("categories")}
          >
            <Boxes /> Categorias
          </button>

          <button
            className={tab === "product-types" ? "active" : ""}
            aria-current={tab === "product-types" ? "page" : undefined}
            disabled={saving || uploadCount > 0}
            onClick={() => setTab("product-types")}
          >
            <Boxes /> Tipos de produto
          </button>

          <button
            className={tab === "brands" ? "active" : ""}
            aria-current={tab === "brands" ? "page" : undefined}
            disabled={saving || uploadCount > 0}
            onClick={() => setTab("brands")}
          >
            <Boxes /> Marcas
          </button>

          <button
            className={tab === "settings" ? "active" : ""}
            aria-current={tab === "settings" ? "page" : undefined}
            disabled={saving || uploadCount > 0}
            onClick={() => setTab("settings")}
          >
            <Settings /> Aparência e loja
          </button>
        </nav>

        <div className="admin-sidebar-bottom">
          <a href="/" target="_blank" rel="noreferrer">
            <LayoutDashboard /> Ver catálogo
          </a>
          <button
            onClick={async () => {
              await supabase?.auth.signOut();
              window.location.assign(
                new URL("/admin/login", window.location.origin),
              );
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
              onClick={() => setProductTypeForm({ ...blankProductType })}
            >
              <Plus /> Novo tipo
            </button>
          )}

          {tab === "brands" && (
            <button
              className="admin-primary"
              onClick={() => setBrandForm({ ...blankBrand })}
            >
              <Plus /> Nova marca
            </button>
          )}
        </header>
        {message && (
          <div
            className="admin-message"
            role="status"
            onClick={() => setMessage("")}
          >
            {message}
            <X size={16} />
          </div>
        )}
        {!galleriesReady && (
          <p role="status" className="cart-notice">
            Para habilitar várias fotos por produto e capa, execute o arquivo
            supabase/schema.sql atualizado no Supabase. As fotos atuais
            continuam disponíveis.
          </p>
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
                            <CatalogImage src={p.image_url} alt={p.name} />
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
                        {(p.promotional_price ?? p.price) !== null
                          ? `R$ ${Number(p.promotional_price ?? p.price)
                              .toFixed(2)
                              .replace(".", ",")}`
                          : "Sob consulta"}
                      </td>

                      <td>
                        <span className={`status ${p.active ? "on" : "off"}`}>
                          {p.active ? "Visível" : "Oculto"}
                        </span>
                      </td>

                      <td className="actions">
                        <button
                          aria-label={`Editar ${p.name}`}
                          disabled={saving || uploadCount > 0}
                          onClick={() => setProductForm({ ...p })}
                        >
                          <Pencil />
                        </button>

                        <button
                          aria-label={`Excluir ${p.name}`}
                          disabled={saving || uploadCount > 0}
                          onClick={() => remove("products", p.id)}
                        >
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
                    {categories.find((c) => c.id === type.category_id)?.name ||
                      "Sem categoria"}
                  </p>

                  <span>{type.description || "Sem descrição"}</span>
                </div>

                <div className="actions">
                  <button onClick={() => setProductTypeForm({ ...type })}>
                    <Pencil />
                  </button>

                  <button onClick={() => remove("product_types", type.id)}>
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
                  <button onClick={() => setBrandForm({ ...brand })}>
                    <Pencil />
                  </button>

                  <button onClick={() => remove("brands", brand.id)}>
                    <Trash2 />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {tab === "settings" && settings && (
          <form
            className="settings-form"
            onSubmit={(event) => void submit(event, saveSettings)}
          >
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
                <ImageUpload
                  label="Logotipo"
                  value={settings.logo_url}
                  onBusy={onUploadBusy}
                  onChange={(url) =>
                    setSettings((current) =>
                      current ? { ...current, logo_url: url } : current,
                    )
                  }
                />
                {galleriesReady ? (
                  <ImageGalleryUpload
                    label="Fotos da capa"
                    value={galleryImages(
                      settings.hero_image_url,
                      settings.hero_image_urls,
                    )}
                    disabled={saving}
                    onBusy={onUploadBusy}
                    onChange={(images) =>
                      setSettings((current) =>
                        current
                          ? {
                              ...current,
                              hero_image_urls: images,
                              hero_image_url: images[0] || null,
                            }
                          : current,
                      )
                    }
                  />
                ) : (
                  <ImageUpload
                    label="Imagem de capa"
                    value={settings.hero_image_url}
                    onBusy={onUploadBusy}
                    onChange={(url) =>
                      setSettings((current) =>
                        current ? { ...current, hero_image_url: url } : current,
                      )
                    }
                  />
                )}
              </div>
            </div>
            <div className="form-section">
              <h2>Cores da loja</h2>
              <div className="form-grid">
                <label>
                  Cor principal
                  <input
                    type="color"
                    value={settings.primary_color}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        primary_color: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Cor de destaque
                  <input
                    type="color"
                    value={settings.accent_color}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        accent_color: event.target.value,
                      })
                    }
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
            <button
              className="admin-primary save"
              disabled={uploadCount > 0 || saving}
            >
              <Save /> Salvar configurações
            </button>
          </form>
        )}
      </section>

      {productForm && (
        <ProductEditor
          productForm={productForm}
          setProductForm={setProductForm}
          categories={categories}
          productTypes={productTypes}
          brands={brands}
          uploadCount={uploadCount}
          saving={saving}
          galleriesReady={galleriesReady}
          onUploadBusy={onUploadBusy}
          onSubmit={(event) => void submit(event, saveProduct)}
        />
      )}
      {productTypeForm && (
        <TaxonomyEditor
          value={productTypeForm}
          title="tipo de produto"
          categories={categories}
          busy={saving || uploadCount > 0}
          onChange={setProductTypeForm}
          onClose={() => setProductTypeForm(null)}
          onSubmit={(event) => void submit(event, saveProductType)}
        />
      )}
      {brandForm && (
        <TaxonomyEditor
          value={brandForm}
          title="marca"
          busy={saving || uploadCount > 0}
          onChange={setBrandForm}
          onClose={() => setBrandForm(null)}
          onSubmit={(event) => void submit(event, saveBrand)}
        />
      )}
      {categoryForm && (
        <TaxonomyEditor
          value={categoryForm}
          title="categoria"
          busy={saving || uploadCount > 0}
          onChange={setCategoryForm}
          onClose={() => setCategoryForm(null)}
          onSubmit={(event) => void submit(event, saveCategory)}
        />
      )}
    </main>
  );
}
