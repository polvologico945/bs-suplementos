"use client";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Minus, Plus, Save, X } from "lucide-react";
import { Modal } from "@/components/modal";
import { ImageUpload } from "./image-upload";
import type {
  Brand,
  Category,
  EditForm,
  Product,
  ProductType,
} from "@/lib/types";

/** Problema: formulário de produto misturado à carga/autorização dificultava
 * revisar alterações e reutilizar o upload. Editor tipado, isolado da persistência.
 * Data: 2026-11-12. @author Carla Evelyn */
export function ProductEditor({
  productForm,
  setProductForm,
  categories,
  productTypes,
  brands,
  uploadCount,
  saving,
  onUploadBusy,
  onSubmit,
}: {
  productForm: EditForm<Product>;
  setProductForm: Dispatch<SetStateAction<EditForm<Product> | null>>;
  categories: Category[];
  productTypes: ProductType[];
  brands: Brand[];
  uploadCount: number;
  saving: boolean;
  onUploadBusy: (busy: boolean) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <Modal
      className="modal-backdrop"
      label="Produto"
      onClose={() => {
        if (!uploadCount && !saving) setProductForm(null);
      }}
    >
      <form className="admin-modal" onSubmit={onSubmit}>
        <div className="modal-title">
          <div>
            <span>CATÁLOGO</span>
            <h2>{productForm.id ? "Editar produto" : "Novo produto"}</h2>
          </div>
          <button
            type="button"
            aria-label="Fechar formulário"
            disabled={uploadCount > 0 || saving}
            onClick={() => setProductForm(null)}
          >
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
                  product_type_id: null,
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
                  (type) =>
                    !productForm.category_id ||
                    type.category_id === productForm.category_id,
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
                  stock_status: e.target.value as Product["stock_status"],
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
                <span>Adicione os sabores disponíveis para este produto.</span>
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
                ),
              )}

              {(!productForm.flavors || productForm.flavors.length === 0) && (
                <p className="no-flavors">
                  Nenhum sabor cadastrado. Se o produto não tiver sabor, deixe
                  esta lista vazia.
                </p>
              )}
            </div>
          </div>
        </div>
        <ImageUpload
          label="Foto do produto"
          value={productForm.image_url}
          onBusy={onUploadBusy}
          onChange={(url) =>
            setProductForm((current) =>
              current ? { ...current, image_url: url } : current,
            )
          }
        />
        <button
          className="admin-primary save"
          disabled={uploadCount > 0 || saving}
        >
          <Save /> Salvar produto
        </button>
      </form>
    </Modal>
  );
}
