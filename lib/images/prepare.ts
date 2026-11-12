export const IMAGE_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif";
const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 350_000;

export function validateImageInput(file: File): void {
  if (!file.size || file.size > MAX_INPUT_BYTES)
    throw new Error("Escolha uma foto de até 20 MB.");
  if (
    !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name) &&
    !/^image\/(jpeg|png|webp|hei[cf])$/i.test(file.type)
  ) {
    throw new Error("Use uma foto JPEG, HEIC, HEIF, PNG ou WebP.");
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.type !== "image/webp")
          reject(
            new Error(
              "Seu navegador não conseguiu otimizar a foto. Atualize-o e tente novamente.",
            ),
          );
        else resolve(blob);
      },
      "image/webp",
      quality,
    ),
  );
}

/**
 * Problema: JPEG/HEIC de iPhone eram enviados inteiros, caros para armazenar e
 * transferir, e HEIC não abre em vários navegadores. A conversão ocorre somente
 * no painel e antes do upload: reduz dimensões, remove EXIF/GPS pelo canvas e
 * publica WebP pequeno. Hash dos bytes evita cópias da mesma imagem no Storage.
 * Data: 2026-11-12. @author Carla Evelyn
 */
export async function prepareImage(
  file: File,
): Promise<{ blob: Blob; path: string; originalSize: number }> {
  validateImageInput(file);
  let source: Blob = file;
  if (/\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/i.test(file.type)) {
    // A versão CSP dispensa unsafe-eval e só é baixada quando uma foto HEIC é escolhida.
    const { heicTo } = await import("heic-to/csp");
    source = await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
  }
  const url = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error(
        "Não conseguimos abrir essa foto. Exporte como JPEG e tente novamente.",
      );
    }
    if (
      !image.naturalWidth ||
      image.naturalWidth * image.naturalHeight > 60_000_000
    )
      throw new Error("A foto excede 60 megapixels. Escolha uma versão menor.");
    const ratio = Math.min(
      1,
      1200 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let blob = await toBlob(canvas, 0.8);
    for (const quality of [0.68, 0.55, 0.4]) {
      if (blob.size <= MAX_OUTPUT_BYTES) break;
      blob = await toBlob(canvas, quality);
    }
    if (blob.size > MAX_OUTPUT_BYTES)
      throw new Error(
        "A foto continua muito grande após a compressão. Escolha uma versão menor.",
      );
    const digest = await crypto.subtle.digest(
      "SHA-256",
      await blob.arrayBuffer(),
    );
    const hash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    return { blob, path: `v2/${hash}.webp`, originalSize: file.size };
  } finally {
    URL.revokeObjectURL(url);
  }
}
