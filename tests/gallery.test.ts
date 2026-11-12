import { describe, expect, it } from "vitest";
import { galleryImages, MAX_GALLERY_IMAGES } from "../lib/images/gallery";

describe("galerias compatíveis com fotos antigas", () => {
  it("mantém a foto legada e permite remover todas as fotos", () => {
    expect(galleryImages("/brand/antiga.jpg")).toEqual(["/brand/antiga.jpg"]);
    expect(galleryImages("/brand/antiga.jpg", [])).toEqual([
      "/brand/antiga.jpg",
    ]);
    expect(galleryImages(null, [])).toEqual([]);
    expect(galleryImages(null, "JSON inválido")).toEqual([]);
  });
  it("a ordem da galeria define a principal e elimina URLs repetidas/vazias", () => {
    expect(
      galleryImages("/brand/antiga.jpg", [
        null,
        "",
        " /brand/nova.jpg ",
        "/brand/detalhe.jpg",
        "/brand/nova.jpg",
        10,
      ]),
    ).toEqual(["/brand/nova.jpg", "/brand/detalhe.jpg"]);
  });
  it("limita galerias recebidas sem confiar nos dados do transporte", () => {
    expect(
      galleryImages(
        null,
        Array.from({ length: 20 }, (_, i) => `/brand/${i}.jpg`),
      ),
    ).toHaveLength(MAX_GALLERY_IMAGES);
  });
});
