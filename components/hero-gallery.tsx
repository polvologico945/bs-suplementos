"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { CatalogImage } from "./catalog-image";
import { useReducedMotion, useSaveData } from "@/hooks/use-media-preferences";

export const HERO_INTERVAL_MS = 6500;
type GalleryState = { index: number; seen: number[]; pending: number | null };
function stageSlide(
  current: GalleryState,
  index: number,
  loaded: Set<number>,
): GalleryState {
  return {
    index: loaded.has(index) ? index : current.index,
    seen: current.seen.includes(index)
      ? current.seen
      : [...current.seen, index],
    pending: loaded.has(index) ? null : index,
  };
}

/** Problema: a capa aceitava uma foto só e um carrossel ingênuo baixaria todas
 * de imediato. Só monta fotos já visitadas e mantém suas URLs/cache. Pausa fora
 * da tela, em aba oculta, por interação, economia de dados ou menos movimento.
 * Data: 2026-11-12. @author Carla Evelyn
 */
export function HeroGallery({
  images,
  children,
}: {
  images: string[];
  children: ReactNode;
}) {
  const root = useRef<HTMLElement>(null);
  const loaded = useRef(new Set<number>());
  const [gallery, setGallery] = useState<GalleryState>({
    index: 0,
    seen: [0],
    pending: null,
  });
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(false);
  const reduced = useReducedMotion();
  const saveData = useSaveData();
  const multiple = images.length > 1;
  const running =
    multiple &&
    !paused &&
    !hovered &&
    visible &&
    !hidden &&
    !reduced &&
    !saveData;

  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.15 },
    );
    if (root.current) observer.observe(root.current);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      if (document.hidden || root.current?.closest("[inert]")) return;
      setGallery((current) => {
        if (current.pending !== null) return current;
        const index = (current.index + 1) % images.length;
        return stageSlide(current, index, loaded.current);
      });
    }, HERO_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [running, images.length, gallery.index]);

  function go(target: number) {
    setPaused(true);
    const index = (target + images.length) % images.length;
    setGallery((current) => stageSlide(current, index, loaded.current));
  }

  return (
    <section
      id="inicio"
      className="hero"
      ref={root}
      aria-label="Capa da loja"
      aria-roledescription={multiple ? "carrossel" : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setPaused(true)}
    >
      <div className="hero-slides" id="hero-slides" aria-hidden="true">
        {gallery.seen.map((index) => (
          <CatalogImage
            key={images[index]}
            className={`hero-slide ${gallery.index === index ? "active" : ""}`}
            src={images[index]}
            alt=""
            width={1600}
            height={900}
            loading="eager"
            fetchPriority={index === 0 ? "high" : "auto"}
            onLoad={() => {
              // Mantém a foto anterior visível até a próxima estar pronta,
              // evitando um quadro vazio em conexões lentas.
              loaded.current.add(index);
              setGallery((current) =>
                current.pending === index
                  ? { ...current, index, pending: null }
                  : current,
              );
            }}
          />
        ))}
      </div>
      <div className="hero-shade" aria-hidden="true" />
      {children}
      {multiple && (
        <div
          className="hero-gallery-controls"
          aria-label="Controles das fotos da capa"
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            go(
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? images.length - 1
                  : gallery.index + (event.key === "ArrowRight" ? 1 : -1),
            );
          }}
        >
          <button
            type="button"
            aria-label="Foto anterior da capa"
            aria-controls="hero-slides"
            onClick={() => go(gallery.index - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          <span
            className="hero-photo-position"
            aria-live={running ? "off" : "polite"}
            aria-atomic="true"
          >
            Foto {gallery.index + 1} de {images.length}
          </span>
          <button
            type="button"
            aria-label="Próxima foto da capa"
            aria-controls="hero-slides"
            onClick={() => go(gallery.index + 1)}
          >
            <ChevronRight size={18} />
          </button>
          {!reduced && !saveData && (
            <button
              type="button"
              className="hero-playback"
              onClick={() => setPaused(!paused)}
              aria-label={
                paused
                  ? "Reproduzir apresentação da capa"
                  : "Pausar apresentação da capa"
              }
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}{" "}
              {paused ? "Reproduzir" : "Pausar"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
