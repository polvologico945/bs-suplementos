"use client";
import { useId, useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from "lucide-react";
import { CatalogImage } from "@/components/catalog-image";
import { IMAGE_ACCEPT } from "@/lib/images/prepare";
import { MAX_GALLERY_IMAGES } from "@/lib/images/gallery";
import { uploadCatalogImage } from "@/lib/images/upload";

export function ImageGalleryUpload({
  label,
  value,
  onChange,
  onBusy,
  disabled = false,
}: {
  label: string;
  value: string[];
  onChange: (images: string[]) => void;
  onBusy: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const helpId = useId();
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    input.value = "";
    if (!files.length || locked.current || disabled) return;
    setErrors([]);
    setStatus("");
    if (files.length + value.length > MAX_GALLERY_IMAGES) {
      setErrors([
        `Use até ${MAX_GALLERY_IMAGES} fotos. Há espaço para mais ${MAX_GALLERY_IMAGES - value.length}.`,
      ]);
      return;
    }
    locked.current = true;
    setBusy(true);
    onBusy(true);
    const next = [...value];
    const failures: string[] = [];
    let added = 0;
    try {
      // Conversão sequencial limita memória ao decodificar várias fotos HEIC de
      // iPhone. Falhas preservam as fotos anteriores e os demais envios concluídos.
      // Data: 2026-11-12. @author Carla Evelyn
      for (const [index, file] of files.entries()) {
        setStatus(
          `Otimizando e enviando foto ${index + 1} de ${files.length}…`,
        );
        try {
          const result = await uploadCatalogImage(file, next);
          if (!next.includes(result.url)) {
            next.push(result.url);
            onChange([...next]);
            added++;
          }
        } catch (error) {
          failures.push(
            `${file.name}: ${error instanceof Error ? error.message : "Não foi possível enviar esta foto."}`,
          );
        }
      }
      setErrors(failures);
      setStatus(
        added
          ? `${added === 1 ? "Foto pronta:" : "Fotos prontas:"} ${added} adicionada${added === 1 ? "" : "s"}. Salve para publicar.`
          : failures.length
            ? "As fotos anteriores foram preservadas."
            : "Essa foto já está na galeria. Nenhuma cópia foi adicionada.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
      onBusy(false);
    }
  }

  function move(index: number, target: number) {
    const next = [...value];
    const [photo] = next.splice(index, 1);
    next.splice(target, 0, photo);
    onChange(next);
    setStatus(`Foto movida para a posição ${target + 1}. Salve para publicar.`);
  }

  return (
    <fieldset
      className="image-gallery-upload"
      disabled={busy || disabled}
      aria-describedby={helpId}
    >
      <legend>{label}</legend>
      <p id={helpId} className="gallery-help">
        Opcional · até {MAX_GALLERY_IMAGES} fotos. A primeira é a principal.
        JPEG, HEIC, HEIF, PNG ou WebP, até 20 MB por foto.
      </p>
      <ol className="admin-gallery-list">
        {value.map((url, index) => (
          <li key={url}>
            <CatalogImage
              src={url}
              alt={`Foto ${index + 1}: ${label}`}
              width={120}
              height={100}
            />
            <span>{index === 0 ? "Principal" : `Foto ${index + 1}`}</span>
            <div className="gallery-edit-actions">
              <button
                type="button"
                aria-label={`Mover foto ${index + 1} para antes`}
                disabled={busy || disabled || index === 0}
                onClick={() => move(index, index - 1)}
              >
                <ArrowLeft size={16} />
              </button>
              <button
                type="button"
                aria-label={`Mover foto ${index + 1} para depois`}
                disabled={busy || disabled || index === value.length - 1}
                onClick={() => move(index, index + 1)}
              >
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                aria-label={`Usar foto ${index + 1} como principal`}
                disabled={busy || disabled || index === 0}
                onClick={() => move(index, 0)}
              >
                <Star size={16} />
              </button>
              <button
                type="button"
                aria-label={`Remover foto ${index + 1}`}
                onClick={() => {
                  onChange(value.filter((_, position) => position !== index));
                  setStatus("Foto removida da seleção. Salve para publicar.");
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </li>
        ))}
      </ol>
      <label className="upload-box compact">
        <ImagePlus aria-hidden="true" />
        <strong>
          {value.length === MAX_GALLERY_IMAGES
            ? "Limite de fotos atingido"
            : "Adicionar fotos"}
        </strong>
        <span>
          {value.length} de {MAX_GALLERY_IMAGES} fotos · pode selecionar várias
          de uma vez
        </span>
        <input
          aria-label={label}
          type="file"
          multiple
          accept={IMAGE_ACCEPT}
          disabled={value.length >= MAX_GALLERY_IMAGES || busy || disabled}
          onChange={(event) => void upload(event)}
        />
      </label>
      {status && (
        <p role="status" className="upload-status">
          {status}
        </p>
      )}
      {errors.length > 0 && (
        <div role="alert" className="form-error">
          {errors.map((error, index) => (
            <p key={index}>{error}</p>
          ))}
        </div>
      )}
    </fieldset>
  );
}
