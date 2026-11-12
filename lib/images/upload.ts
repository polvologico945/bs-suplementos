import { createClient } from "@/lib/supabase/client";
import { prepareImage } from "./prepare";

/** Problema: vários seletores de fotos repetiam a persistência e o mesmo arquivo
 * podia ser reenviado. Todos usam o WebP com nome SHA-256 e cache já existentes;
 * uma foto presente nesta galeria nem gera outra chamada ao Storage.
 * Data: 2026-11-12. @author Carla Evelyn
 */
export async function uploadCatalogImage(file: File, knownUrls: string[] = []) {
  const db = createClient();
  if (!db) throw new Error("Configure o Supabase para enviar imagens.");
  const { blob, path, originalSize } = await prepareImage(file);
  const url = db.storage.from("catalog").getPublicUrl(path).data.publicUrl;
  if (knownUrls.includes(url))
    return { url, bytes: blob.size, originalSize, duplicate: true };
  const { error } = await db.storage.from("catalog").upload(path, blob, {
    upsert: false,
    contentType: "image/webp",
    cacheControl: "31536000",
  });
  if (error) {
    if (
      !["409", "400"].includes(
        String((error as { statusCode?: string }).statusCode),
      )
    )
      throw error;
    const existing = await db.storage.from("catalog").info(path);
    if (existing.error) throw error;
  }
  return { url, bytes: blob.size, originalSize, duplicate: false };
}
