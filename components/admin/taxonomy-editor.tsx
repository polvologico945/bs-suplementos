"use client";
import type { FormEvent } from "react";
import { Save, X } from "lucide-react";
import { Modal } from "@/components/modal";
import type { Brand, Category, EditForm } from "@/lib/types";

type Taxonomy = EditForm<Brand> & { category_id?: string };

/** Problema: três formulários repetiam campos e não expunham visibilidade/ordem
 * de maneira consistente. Compartilha controles sem misturar as relações SQL.
 * Data: 2026-11-12. @author Carla Evelyn */
export function TaxonomyEditor<T extends Taxonomy>({
  value,
  title,
  categories,
  busy,
  onChange,
  onClose,
  onSubmit,
}: {
  value: T;
  title: string;
  categories?: Category[];
  busy: boolean;
  onChange: (value: T) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <Modal
      className="modal-backdrop"
      label={title}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form className="admin-modal small" onSubmit={onSubmit}>
        <div className="modal-title">
          <div>
            <span>ORGANIZAÇÃO</span>
            <h2>
              {value.id ? "Editar" : "Cadastrar"} {title}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Fechar formulário"
            disabled={busy}
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        <div className="form-grid">
          {categories && (
            <label className="wide">
              Categoria
              <select
                required
                value={value.category_id || ""}
                onChange={(event) =>
                  onChange({ ...value, category_id: event.target.value })
                }
              >
                <option value="">Selecione uma categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="wide">
            Nome
            <input
              required
              maxLength={80}
              value={value.name}
              onChange={(event) =>
                onChange({ ...value, name: event.target.value })
              }
            />
          </label>
          <label className="wide">
            Descrição
            <textarea
              maxLength={600}
              value={value.description || ""}
              onChange={(event) =>
                onChange({ ...value, description: event.target.value })
              }
            />
          </label>
          <label>
            Ordem de exibição
            <input
              type="number"
              min={0}
              step={1}
              value={value.sort_order}
              onChange={(event) =>
                onChange({ ...value, sort_order: Number(event.target.value) })
              }
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={value.active}
              onChange={(event) =>
                onChange({ ...value, active: event.target.checked })
              }
            />
            Visível no catálogo
          </label>
        </div>
        <button className="admin-primary save" disabled={busy}>
          <Save />
          {busy ? "Salvando…" : "Salvar"}
        </button>
      </form>
    </Modal>
  );
}
