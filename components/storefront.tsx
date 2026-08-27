"use client";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Instagram,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { loadCatalog } from "@/lib/store";
import type {
  CartItem,
  Category,
  Product,
  ProductType,
  StoreSettings,
} from "@/lib/types";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );

export default function Storefront() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedProductType, setSelectedProductType] = useState("all");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [demo, setDemo] = useState(false);
  const [flavorProduct, setFlavorProduct] = useState<Product | null>(null);
  const [selectedFlavor, setSelectedFlavor] = useState("");
  
  useEffect(() => {
    loadCatalog().then((data) => {
      setSettings(data.settings);
      setCategories(data.categories);
      setProductTypes(data.productTypes);
      setProducts(data.products);
      setDemo(data.demo);
    });
    const saved = localStorage.getItem("bs-cart");
    if (saved) setCart(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("bs-cart", JSON.stringify(cart));
  }, [cart]);

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const categoryMatch =
          selectedCategory === "all" ||
          p.category_id === selectedCategory;

        const productTypeMatch =
          selectedProductType === "all" ||
          p.product_type_id === selectedProductType;

        const text =
          `${p.name} ${p.brand ?? ""} ${p.description ?? ""}`.toLowerCase();

        return (
          categoryMatch &&
          productTypeMatch &&
          text.includes(query.toLowerCase())
        );
      }),
    [products, selectedCategory, selectedProductType, query],
  );

  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce(
    (sum, item) =>
      sum + (item.promotional_price ?? item.price ?? 0) * item.quantity,
    0,
  );

  function addToCart(product: Product, flavor?: string) {
    const selected = flavor || null;

    setCart((current) => {
      const existing = current.find(
        (item) =>
          item.id === product.id &&
          item.flavor === selected
      );

      if (existing) {
        return current.map((item) =>
          item.id === product.id &&
          item.flavor === selected
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      }

      return [
        ...current,
        {
          ...product,
          quantity: 1,
          flavor: selected,
        },
      ];
    });

    setCartOpen(true);
  }

  function changeQty(
    id: string,
    flavor: string | null | undefined,
    delta: number,
  ) {
    setCart((current) =>
      current.map((i) =>
        i.id === id && i.flavor === flavor
          ? {
              ...i,
              quantity: Math.max(1, i.quantity + delta),
            }
          : i,
      ),
    );
  }

  function checkout() {
    if (!settings || !cart.length) return;
    const lines = cart.map(
      (item) =>
        `• ${item.quantity}x ${item.name}${
          item.brand ? ` — ${item.brand}` : ""
        }${
          item.flavor ? ` — Sabor: ${item.flavor}` : ""
        }${
          item.price
            ? ` (${money(
                (item.promotional_price ?? item.price) * item.quantity,
              )})`
            : ""
        }`
    );
    const message = [
      "Olá! Vim pelo catálogo da BS Suplementos e quero finalizar este pedido:",
      "",
      ...lines,
      total > 0 ? `\nTotal estimado: ${money(total)}` : "",
      "",
      "Pode confirmar disponibilidade, sabores e forma de pagamento?",
    ]
      .filter(Boolean)
      .join("\n");
    window.open(
      `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  if (!settings) return <div className="loading">Carregando catálogo…</div>;

  return (
    <main
      style={
        {
          "--primary": settings.primary_color,
          "--accent": settings.accent_color,
        } as React.CSSProperties
      }
    >
      <header className="topbar">
        <a className="brand" href="#inicio">
          <img
            src={settings.logo_url || "/brand/logo-card.jpg"}
            alt="BS Suplementos"
          />
          <span>
            <strong>{settings.store_name}</strong>
            <small>Suplementações</small>
          </span>
        </a>
        <button
          className="cart-button"
          onClick={() => setCartOpen(true)}
          aria-label="Abrir carrinho"
        >
          <ShoppingBag size={21} />
          <span>Carrinho</span>
          {count > 0 && <b>{count}</b>}
        </button>
      </header>

      <section
        id="inicio"
        className="hero"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(7,12,9,.96), rgba(7,12,9,.76), rgba(7,12,9,.18)), url(${settings.hero_image_url || "/brand/card-front.jpg"})`,
        }}
      >
        <div className="hero-content">
          <span className="eyebrow">
            SUPLEMENTAÇÃO • PERFORMANCE • BEM-ESTAR
          </span>
          <h1>Seu objetivo começa com a escolha certa.</h1>
          <p>{settings.tagline}</p>
          <div className="hero-actions">
            <a className="primary-button" href="#produtos">
              Ver produtos <ChevronRight size={18} />
            </a>
            <a
              className="secondary-button"
              href={`https://wa.me/${settings.whatsapp}`}
              target="_blank"
              rel="noreferrer"
            >
              Falar no WhatsApp
            </a>
          </div>
          <div className="trust-row">
            <span>
              <Check size={16} /> Atendimento rápido
            </span>
            <span>
              <Check size={16} /> Pedido pelo WhatsApp
            </span>
          </div>
        </div>
      </section>

      {demo && (
        <div className="demo-banner">
          Versão de demonstração. Conecte o Supabase para habilitar o painel
          administrativo e os dados reais.
        </div>
      )}

      <section id="produtos" className="catalog-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow dark">NOSSO CATÁLOGO</span>
            <h2>Encontre o que combina com seu treino</h2>
          </div>
          <p>
            Selecione os produtos, monte o carrinho e finalize diretamente com a
            loja.
          </p>
        </div>

        <div className="catalog-tools">
          <div className="search-box">
            <Search size={19} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar produto, marca ou categoria…"
            />
          </div>
          
          <div className="catalog-filters">

            <div className="filter-group">
              <span className="filter-label">Categoria</span>

              <div className="category-pills">
                <button
                  className={selectedCategory === "all" ? "active" : ""}
                  onClick={() => {
                    setSelectedCategory("all");
                    setSelectedProductType("all");
                  }}
                >
                  Todos
                </button>

                {categories.map((c) => (
                  <button
                    key={c.id}
                    className={selectedCategory === c.id ? "active" : ""}
                    onClick={() => {
                      setSelectedCategory(c.id);
                      setSelectedProductType("all");
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {selectedCategory !== "all" && (
              <div className="filter-group">
                <span className="filter-label">Tipo de produto</span>

                <div className="category-pills">
                  <button
                    className={selectedProductType === "all" ? "active" : ""}
                    onClick={() => setSelectedProductType("all")}
                  >
                    Todos
                  </button>

                  {productTypes
                    .filter((type) => type.category_id === selectedCategory)
                    .map((type) => (
                      <button
                        key={type.id}
                        className={
                          selectedProductType === type.id ? "active" : ""
                        }
                        onClick={() => setSelectedProductType(type.id)}
                      >
                        {type.name}
                      </button>
                    ))}
                </div>
              </div>
            )}

          </div>

        </div>

        <div className="product-grid">
          {filtered.map((product, index) => (
            <article className="product-card" key={product.id}>
              <div className="product-image" style={{ position: "relative", width: "100%", height: "240px", overflow: "hidden" }}>
                {product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    style={{ objectFit: "cover" }}
                    priority={index < 2}
                    loading={index >= 2 ? "lazy" : undefined}
                  />
                ) : (
                  <div className="image-placeholder" style={{ position: "relative", width: "100%", height: "100%" }}>
                    <Image
                      src={settings.logo_url || "/brand/logo-card.jpg"}
                      alt=""
                      fill
                      style={{ objectFit: "contain", padding: "20px" }}
                    />
                  </div>
                )}
                {product.featured && <span className="badge">Destaque</span>}
                {product.stock_status === "unavailable" && (
                  <span className="stock unavailable">Indisponível</span>
                )}
              </div>
              
              <div className="product-body">
                <span className="brand-name">
                  {product.brand || "BS Suplementos"}
                </span>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <div className="price-row">
                  <div>
                    {product.promotional_price ? (
                      <>
                        <small>
                          {product.price ? money(product.price) : ""}
                        </small>
                        <strong>{money(product.promotional_price)}</strong>
                      </>
                    ) : product.price ? (
                      <strong>{money(product.price)}</strong>
                    ) : (
                      <strong className="consult">Consulte o valor</strong>
                    )}
                  </div>
                  <button
                    disabled={product.stock_status === "unavailable"}
                    onClick={() => {
                      if (product.flavors?.length) {
                        setFlavorProduct(product);
                        setSelectedFlavor("");
                      } else {
                        addToCart(product);
                      }
                    }}
                  >
                    <Plus size={18} /> Adicionar
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {!filtered.length && (
          <div className="empty-state">
            Nenhum produto encontrado com esses filtros.
          </div>
        )}
      </section>

      <section className="contact-strip">
        <div>
          <h2>Precisa de ajuda para escolher?</h2>
          <p>
            Converse com a loja e confirme sabores, tamanhos e disponibilidade.
          </p>
        </div>
        <a
          href={`https://wa.me/${settings.whatsapp}`}
          target="_blank"
          rel="noreferrer"
        >
          Chamar no WhatsApp <ChevronRight size={18} />
        </a>
      </section>

      <footer>
        <div className="footer-brand">
          <img
            src={settings.logo_url || "/brand/logo-card.jpg"}
            alt="BS Suplementos"
          />
          <div>
            <strong>{settings.store_name}</strong>
            <span>Suplementos e performance</span>
          </div>
        </div>
        <div className="footer-info">
          {settings.instagram && (
            <span>
              <Instagram size={17} /> {settings.instagram}
            </span>
          )}
          {settings.address && (
            <span>
              <MapPin size={17} /> {settings.address}
            </span>
          )}
        </div>
        <a className="admin-link" href="/admin/login">
          Área administrativa
        </a>
      </footer>

      {cartOpen && (
        <div className="drawer-backdrop" onMouseDown={() => setCartOpen(false)}>
          <aside
            className="cart-drawer"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <span>SEU PEDIDO</span>
                <h2>Carrinho</h2>
              </div>
              <button onClick={() => setCartOpen(false)}>
                <X />
              </button>
            </div>
            <div className="cart-list">
              {!cart.length && (
                <div className="empty-cart">
                  <ShoppingBag size={38} />
                  <h3>Seu carrinho está vazio</h3>
                  <p>Adicione produtos para enviar o pedido pelo WhatsApp.</p>
                </div>
              )}
              {cart.map((item) => (
                <div
                  className="cart-item"
                  key={`${item.id}-${item.flavor ?? "sem-sabor"}`}
                >
                  <div className="cart-thumb" style={{ overflow: "hidden", borderRadius: "6px" }}>
                    <Image 
                      src={item.image_url || settings.logo_url || "/brand/logo-card.jpg"} 
                      alt="" 
                      width={60} 
                      height={60} 
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                  <div className="cart-info">
                    <strong>{item.name}</strong>
                    <span>{item.brand}</span>

                    {item.flavor && (
                      <small>Sabor: {item.flavor}</small>
                    )}
                    <div className="qty">
                      <button
                        onClick={() => changeQty(item.id, item.flavor, -1)}
                      >
                        <Minus size={15} />
                      </button>
                      <b>{item.quantity}</b>
                        <button
                          onClick={() => changeQty(item.id, item.flavor, 1)}
                        >
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>
                  <button
                    className="remove"
                    onClick={() =>
                      setCart(
                        cart.filter(
                          (i) =>
                            !(i.id === item.id && i.flavor === item.flavor)
                        )
                      )
                    }
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
            <div className="drawer-footer">
              {total > 0 && (
                <div className="total">
                  <span>Total estimado</span>
                  <strong>{money(total)}</strong>
                </div>
              )}
              <button
                className="checkout"
                disabled={!cart.length}
                onClick={checkout}
              >
                Comprar pelo WhatsApp <ChevronRight size={19} />
              </button>
              <small>
                O pedido será enviado à loja para confirmação de estoque e
                pagamento.
              </small>
            </div>
          </aside>
        </div>
      )}
      {flavorProduct && (
        <div
          className="flavor-modal-backdrop"
          onMouseDown={() => setFlavorProduct(null)}
        >
          <div
            className="flavor-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <span>ESCOLHA UMA OPÇÃO</span>
                <h2>{flavorProduct.name}</h2>
              </div>

              <button onClick={() => setFlavorProduct(null)}>
                <X />
              </button>
            </div>

            <p>Selecione o sabor desejado:</p>

            <div className="flavor-options">
              {flavorProduct.flavors?.map((flavor) => (
                <button
                  key={flavor}
                  className={selectedFlavor === flavor ? "active" : ""}
                  onClick={() => setSelectedFlavor(flavor)}
                >
                  {flavor}
                </button>
              ))}
            </div>

            <button
              className="checkout"
              disabled={!selectedFlavor}
              onClick={() => {
                addToCart(flavorProduct, selectedFlavor);
                setFlavorProduct(null);
                setSelectedFlavor("");
                setCartOpen(true);
              }}
            >
              Adicionar ao carrinho
              <ChevronRight size={19} />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
