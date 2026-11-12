"use client";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { CatalogImage } from "./catalog-image";
import { Modal } from "./modal";
import { galleryImages } from "@/lib/images/gallery";
import type { Product } from "@/lib/types";

/** Problema: o visitante não tinha como consultar outras vistas do produto.
 * Carrega somente a foto selecionada, com a mesma URL canônica do card/carrinho;
 * setas, botões e gesto de toque oferecem alternativas sem reprodução automática.
 * Data: 2026-11-12. @author Carla Evelyn
 */
export function ProductGallery({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const images = galleryImages(product.image_url, product.image_urls);
  const [index, setIndex] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const go = (target: number) =>
    setIndex((target + images.length) % images.length);
  return (
    <Modal
      className="modal-backdrop product-gallery-backdrop"
      label={`Fotos de ${product.name}`}
      onClose={onClose}
    >
      <section
        className="product-gallery"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          go(
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? images.length - 1
                : index + (event.key === "ArrowRight" ? 1 : -1),
          );
        }}
      >
        <div className="modal-title">
          <div>
            <span>GALERIA DO PRODUTO</span>
            <h2>{product.name}</h2>
          </div>
          <button type="button" aria-label="Fechar galeria" onClick={onClose}>
            <X />
          </button>
        </div>
        <div
          className="gallery-photo"
          onPointerDown={(event) => {
            if (event.pointerType === "touch")
              touch.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerCancel={() => {
            touch.current = null;
          }}
          onPointerUp={(event) => {
            if (!touch.current) return;
            const dx = event.clientX - touch.current.x;
            const dy = event.clientY - touch.current.y;
            touch.current = null;
            if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.5)
              go(index + (dx < 0 ? 1 : -1));
          }}
        >
          <CatalogImage
            key={images[index]}
            src={images[index]}
            alt={`${product.name} — foto ${index + 1} de ${images.length}`}
            width={1200}
            height={1200}
            loading="eager"
          />
        </div>
        <div className="gallery-navigation">
          <button
            type="button"
            aria-label="Foto anterior do produto"
            onClick={() => go(index - 1)}
          >
            <ChevronLeft />
          </button>
          <p role="status" aria-atomic="true">
            Foto {index + 1} de {images.length}
          </p>
          <button
            type="button"
            aria-label="Próxima foto do produto"
            onClick={() => go(index + 1)}
          >
            <ChevronRight />
          </button>
        </div>
        <div
          className="gallery-positions"
          role="group"
          aria-label="Escolher foto do produto"
        >
          {images.map((url, position) => (
            <button
              type="button"
              key={url}
              aria-label={`Ver foto ${position + 1} de ${images.length}`}
              aria-current={position === index ? "true" : undefined}
              onClick={() => go(position)}
            >
              {position + 1}
            </button>
          ))}
        </div>
        <p className="gallery-help">
          Use os botões, as setas do teclado ou deslize a foto para os lados.
          Esc fecha a galeria.
        </p>
      </section>
    </Modal>
  );
}
