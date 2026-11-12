"use client";
import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { IMAGE_ACCEPT, prepareImage } from "@/lib/images/prepare";
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
              const db = createClient();
              if (!db)
                throw new Error("Configure o Supabase para enviar imagens.");
              const { blob, path, originalSize } = await prepareImage(file);
              setStatus("Enviando a foto otimizada…");
              const { error } = await db.storage
                .from("catalog")
                .upload(path, blob, {
                  upsert: false,
                  contentType: "image/webp",
                  cacheControl: "31536000",
                });
              // O nome é o hash: um objeto já existente tem exatamente o mesmo conteúdo.
              if (
                error &&
                !["409", "400"].includes(
                  String((error as { statusCode?: string }).statusCode),
                )
              )
                throw error;
              if (error) {
                const existing = await db.storage.from("catalog").info(path);
                if (existing.error) throw error;
              }
              onChange(
                db.storage.from("catalog").getPublicUrl(path).data.publicUrl,
              );
              setStatus(
                `Foto pronta: ${Math.ceil(blob.size / 1024)} KB (redução de ${Math.max(0, Math.round((1 - blob.size / originalSize) * 100))}%). Salve para publicar.`,
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
