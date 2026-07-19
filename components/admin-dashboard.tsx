"use client";

import { FormEvent, useEffect, useState } from "react";
import { Boxes, ImagePlus, LayoutDashboard, LogOut, Package, Pencil, Plus, Save, Settings, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Category, Product, StoreSettings } from "@/lib/types";

const blankProduct: Omit<Product, "id"> = { category_id: null, name: "", brand: "", description: "", price: null, promotional_price: null, image_url: null, active: true, featured: false, stock_status: "available", sort_order: 0 };
const blankCategory: Omit<Category, "id"> = { name: "", slug: "", description: "", image_url: null, sort_order: 0, active: true };

export default function AdminDashboard() {
  const supabase = createClient();
  const [tab, setTab] = useState<"products" | "categories" | "settings">("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [productForm, setProductForm] = useState<any>(null);
  const [categoryForm, setCategoryForm] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => { init(); }, []);

  async function init() {
    if (!supabase) { location.href = "/admin/login"; return; }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { location.href = "/admin/login"; return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
    if (profile?.role !== "admin") { await supabase.auth.signOut(); location.href = "/admin/login"; return; }
    await refresh(); setReady(true);
  }

  async function refresh() {
    if (!supabase) return;
    const [p, c, s] = await Promise.all([
      supabase.from("products").select("*").order("sort_order"),
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("store_settings").select("*").eq("id", 1).single()
    ]);
    setProducts((p.data || []) as Product[]); setCategories((c.data || []) as Category[]); setSettings(s.data as StoreSettings);
  }

  async function upload(file: File, folder: string) {
    if (!supabase) return null;
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("catalog").upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    return supabase.storage.from("catalog").getPublicUrl(path).data.publicUrl;
  }

  async function saveProduct(e: FormEvent) {
    e.preventDefault(); if (!supabase || !productForm) return;
    const data = { ...productForm }; delete data.id;
    const result = productForm.id ? await supabase.from("products").update(data).eq("id", productForm.id) : await supabase.from("products").insert(data);
    setMessage(result.error ? result.error.message : "Produto salvo."); if (!result.error) { setProductForm(null); await refresh(); }
  }

  async function saveCategory(e: FormEvent) {
    e.preventDefault(); if (!supabase || !categoryForm) return;
    const data = { ...categoryForm, slug: categoryForm.slug || categoryForm.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") }; delete data.id;
    const result = categoryForm.id ? await supabase.from("categories").update(data).eq("id", categoryForm.id) : await supabase.from("categories").insert(data);
    setMessage(result.error ? result.error.message : "Categoria salva."); if (!result.error) { setCategoryForm(null); await refresh(); }
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault(); if (!supabase || !settings) return;
    const { error } = await supabase.from("store_settings").update(settings).eq("id", 1);
    setMessage(error ? error.message : "Configurações salvas.");
  }

  async function remove(table: "products" | "categories", id: string) {
    if (!supabase || !confirm("Tem certeza que deseja remover?")) return;
    const { error } = await supabase.from(table).delete().eq("id", id); setMessage(error ? error.message : "Item removido."); await refresh();
  }

  if (!ready) return <div className="loading">Validando acesso…</div>;

  return <main className="admin-shell">
    <aside className="admin-sidebar">
      <div className="admin-brand"><img src={settings?.logo_url || "/brand/logo-card.jpg"} alt="" /><div><strong>BS Suplementos</strong><span>Administração</span></div></div>
      <nav>
        <button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}><Package /> Produtos</button>
        <button className={tab === "categories" ? "active" : ""} onClick={() => setTab("categories")}><Boxes /> Categorias</button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}><Settings /> Aparência e loja</button>
      </nav>
      <div className="admin-sidebar-bottom"><a href="/" target="_blank"><LayoutDashboard /> Ver catálogo</a><button onClick={async () => { await supabase?.auth.signOut(); location.href = "/admin/login"; }}><LogOut /> Sair</button></div>
    </aside>

    <section className="admin-content">
      <header><div><span>PAINEL ADMINISTRATIVO</span><h1>{tab === "products" ? "Produtos" : tab === "categories" ? "Categorias" : "Aparência e informações"}</h1></div>{tab === "products" && <button className="admin-primary" onClick={() => setProductForm({ ...blankProduct })}><Plus /> Novo produto</button>}{tab === "categories" && <button className="admin-primary" onClick={() => setCategoryForm({ ...blankCategory })}><Plus /> Nova categoria</button>}</header>
      {message && <div className="admin-message" onClick={() => setMessage("")}>{message}<X size={16} /></div>}

      {tab === "products" && <div className="admin-table-wrap"><table><thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Status</th><th></th></tr></thead><tbody>{products.map((p) => <tr key={p.id}><td><div className="table-product">{p.image_url ? <img src={p.image_url} alt="" /> : <div className="mini-placeholder"><Package /></div>}<div><strong>{p.name}</strong><span>{p.brand}</span></div></div></td><td>{categories.find((c) => c.id === p.category_id)?.name || "Sem categoria"}</td><td>{p.price ? `R$ ${Number(p.promotional_price ?? p.price).toFixed(2).replace(".", ",")}` : "Sob consulta"}</td><td><span className={`status ${p.active ? "on" : "off"}`}>{p.active ? "Visível" : "Oculto"}</span></td><td className="actions"><button onClick={() => setProductForm({ ...p })}><Pencil /></button><button onClick={() => remove("products", p.id)}><Trash2 /></button></td></tr>)}</tbody></table></div>}

      {tab === "categories" && <div className="admin-cards">{categories.map((c) => <article key={c.id}><div className="category-icon"><Boxes /></div><div><strong>{c.name}</strong><p>{c.description || "Sem descrição"}</p><span>{products.filter((p) => p.category_id === c.id).length} produto(s)</span></div><div className="actions"><button onClick={() => setCategoryForm({ ...c })}><Pencil /></button><button onClick={() => remove("categories", c.id)}><Trash2 /></button></div></article>)}</div>}

      {tab === "settings" && settings && <form className="settings-form" onSubmit={saveSettings}>
        <div className="form-section"><h2>Identidade da loja</h2><div className="form-grid"><label>Nome da loja<input value={settings.store_name} onChange={(e) => setSettings({ ...settings, store_name: e.target.value })} /></label><label>Frase principal<input value={settings.tagline} onChange={(e) => setSettings({ ...settings, tagline: e.target.value })} /></label><label>Cor principal<input type="color" value={settings.primary_color} onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })} /></label><label>Cor de destaque<input type="color" value={settings.accent_color} onChange={(e) => setSettings({ ...settings, accent_color: e.target.value })} /></label></div></div>
        <div className="form-section"><h2>Imagens do site</h2><div className="upload-grid"><label className="upload-box"><ImagePlus /><strong>Alterar logotipo</strong><span>PNG, JPG ou WEBP</span><input type="file" accept="image/*" onChange={async (e) => { const f=e.target.files?.[0]; if(f) setSettings({ ...settings, logo_url: await upload(f,"branding") }); }} /></label><label className="upload-box"><ImagePlus /><strong>Alterar imagem de capa</strong><span>Imagem horizontal recomendada</span><input type="file" accept="image/*" onChange={async (e) => { const f=e.target.files?.[0]; if(f) setSettings({ ...settings, hero_image_url: await upload(f,"branding") }); }} /></label></div></div>
        <div className="form-section"><h2>Contato</h2><div className="form-grid"><label>WhatsApp com DDI<input value={settings.whatsapp} onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value.replace(/\D/g,"") })} /></label><label>Instagram<input value={settings.instagram || ""} onChange={(e) => setSettings({ ...settings, instagram: e.target.value })} /></label><label className="wide">Endereço<input value={settings.address || ""} onChange={(e) => setSettings({ ...settings, address: e.target.value })} /></label></div></div>
        <button className="admin-primary save"><Save /> Salvar configurações</button>
      </form>}
    </section>

    {productForm && <div className="modal-backdrop"><form className="admin-modal" onSubmit={saveProduct}><div className="modal-title"><div><span>CATÁLOGO</span><h2>{productForm.id ? "Editar produto" : "Novo produto"}</h2></div><button type="button" onClick={() => setProductForm(null)}><X /></button></div><div className="form-grid"><label className="wide">Nome<input required value={productForm.name} onChange={(e) => setProductForm({...productForm,name:e.target.value})} /></label><label>Marca<input value={productForm.brand || ""} onChange={(e) => setProductForm({...productForm,brand:e.target.value})} /></label><label>Categoria<select value={productForm.category_id || ""} onChange={(e) => setProductForm({...productForm,category_id:e.target.value || null})}><option value="">Sem categoria</option>{categories.map((c)=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label>Preço<input type="number" min="0" step="0.01" value={productForm.price ?? ""} onChange={(e) => setProductForm({...productForm,price:e.target.value?Number(e.target.value):null})} /></label><label>Preço promocional<input type="number" min="0" step="0.01" value={productForm.promotional_price ?? ""} onChange={(e) => setProductForm({...productForm,promotional_price:e.target.value?Number(e.target.value):null})} /></label><label className="wide">Descrição<textarea value={productForm.description || ""} onChange={(e) => setProductForm({...productForm,description:e.target.value})} /></label><label>Status do estoque<select value={productForm.stock_status} onChange={(e) => setProductForm({...productForm,stock_status:e.target.value})}><option value="available">Disponível</option><option value="low">Estoque baixo</option><option value="unavailable">Indisponível</option></select></label><label>Ordem<input type="number" value={productForm.sort_order} onChange={(e) => setProductForm({...productForm,sort_order:Number(e.target.value)})} /></label><label className="check"><input type="checkbox" checked={productForm.active} onChange={(e) => setProductForm({...productForm,active:e.target.checked})} /> Visível no catálogo</label><label className="check"><input type="checkbox" checked={productForm.featured} onChange={(e) => setProductForm({...productForm,featured:e.target.checked})} /> Marcar como destaque</label></div><label className="upload-box compact"><ImagePlus /><strong>Foto do produto</strong><input type="file" accept="image/*" onChange={async (e) => { const f=e.target.files?.[0]; if(f) setProductForm({...productForm,image_url:await upload(f,"products")}); }} /></label>{productForm.image_url && <img className="form-preview" src={productForm.image_url} alt="Prévia" />}<button className="admin-primary save"><Save /> Salvar produto</button></form></div>}

    {categoryForm && <div className="modal-backdrop"><form className="admin-modal small" onSubmit={saveCategory}><div className="modal-title"><div><span>ORGANIZAÇÃO</span><h2>{categoryForm.id ? "Editar categoria" : "Nova categoria"}</h2></div><button type="button" onClick={() => setCategoryForm(null)}><X /></button></div><div className="form-grid"><label className="wide">Nome<input required value={categoryForm.name} onChange={(e) => setCategoryForm({...categoryForm,name:e.target.value})} /></label><label className="wide">Descrição<textarea value={categoryForm.description || ""} onChange={(e) => setCategoryForm({...categoryForm,description:e.target.value})} /></label><label>Ordem<input type="number" value={categoryForm.sort_order} onChange={(e) => setCategoryForm({...categoryForm,sort_order:Number(e.target.value)})} /></label><label className="check"><input type="checkbox" checked={categoryForm.active} onChange={(e) => setCategoryForm({...categoryForm,active:e.target.checked})} /> Visível</label></div><button className="admin-primary save"><Save /> Salvar categoria</button></form></div>}
  </main>;
}
