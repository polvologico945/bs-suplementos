"use client";
import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { IMAGE_ACCEPT } from "@/lib/images/prepare";
import { uploadCatalogImage } from "@/lib/images/upload";
import { CatalogImage } from "@/components/catalog-image";

export function ImageUpload({
  label,
  value,
  onChange,
  onBusy,
}: {
  label: string;
  value: string | null;
  onChange: (url: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  return (
    <div className="image-upload">
      <label className="upload-box compact">
        <ImagePlus />
        <strong>{label}</strong>
        <span>JPEG, HEIC, HEIF, PNG ou WebP · até 20 MB</span>
        <input
          type="file"
          accept={IMAGE_ACCEPT}
          disabled={busy}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setBusy(true);
            onBusy(true);
            setStatus("Otimizando a foto…");
            try {
              const { url, bytes, originalSize } = await uploadCatalogImage(
                file,
                value ? [value] : [],
              );
              onChange(url);
              setStatus(
                `Foto pronta: ${Math.ceil(bytes / 1024)} KB (redução de ${Math.max(0, Math.round((1 - bytes / originalSize) * 100))}%). Salve para publicar.`,
              );
            } catch (error) {
              setStatus(
                error instanceof Error
                  ? error.message
                  : "Não foi possível enviar a foto. Tente novamente.",
              );
            } finally {
              setBusy(false);
              onBusy(false);
              event.target.value = "";
            }
          }}
        />
      </label>
      {status && (
        <p role="status" className="upload-status">
          {status}
        </p>
      )}
      {value && (
        <CatalogImage
          className="form-preview"
          src={value}
          alt={`Prévia: ${label}`}
          width={240}
          height={180}
        />
      )}
    </div>
  );
}
