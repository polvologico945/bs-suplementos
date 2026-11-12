export const MAX_GALLERY_IMAGES = 6;

/** Problema: uma foto única impedia mostrar detalhes e listas repetidas podiam
 * transferir o mesmo objeto mais vezes. A ordem define a principal; o campo antigo
 * continua como fallback para cadastros anteriores à migração.
 * Data: 2026-11-12. @author Carla Evelyn
 */
export function galleryImages(
  primary: string | null | undefined,
  images?: unknown,
): string[] {
  const clean = (values: unknown[]) => [
    ...new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
  const ordered = Array.isArray(images) ? clean(images) : [];
  return (ordered.length ? ordered : clean([primary])).slice(
    0,
    MAX_GALLERY_IMAGES,
  );
}
