import { afterEach, describe, expect, it, vi } from "vitest";
import { mediaUrl } from "../lib/media";
import { GET } from "../app/media/[...path]/route";
import sharp from "sharp";
import { readFile } from "node:fs/promises";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("entrega de imagens", () => {
  it("usa a mesma URL e recusa origens externas", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://loja.supabase.co");
    expect(
      mediaUrl(
        "https://loja.supabase.co/storage/v1/object/public/catalog/products/foto.jpg",
      ),
    ).toBe("/media/products/foto.jpg");
    expect(mediaUrl("https://externo.example/foto.jpg")).toBe(
      "/brand/logo-card.jpg",
    );
    expect(
      mediaUrl(
        "https://loja.supabase.co/storage/v1/object/public/outro/foto.jpg",
      ),
    ).toBe("/brand/logo-card.jpg");
  });
  it("converte um original e retorna cache longo sem transformações por tamanho", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://loja.supabase.co");
    const original = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: "red" },
    })
      .jpeg()
      .toBuffer();
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(original, { headers: { "Content-Type": "image/jpeg" } }),
      );
    vi.stubGlobal("fetch", fetcher);
    const response = await GET(
      new Request("https://loja/media/products/foto.jpg"),
      { params: Promise.resolve({ path: ["products", "foto.jpg"] }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toContain(
      "2592000",
    );
    const output = Buffer.from(await response.arrayBuffer());
    expect(output.length).toBeLessThan(original.length);
    expect((await sharp(output).metadata()).width).toBe(1200);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("converte HEIC legado na primeira leitura", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://loja.supabase.co");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(await readFile("tests/fixtures/iphone.heic"), {
          headers: { "Content-Type": "image/heic" },
        }),
      ),
    );
    const response = await GET(new Request("https://loja/media/old.heic"), {
      params: Promise.resolve({ path: ["old.heic"] }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
  });
  it("falhas de origem não são armazenadas no cache", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://loja.supabase.co");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const response = await GET(new Request("https://loja/media/foto.jpg"), {
      params: Promise.resolve({ path: ["foto.jpg"] }),
    });
    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("recusa caminhos inválidos antes de consultar o Storage", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://loja.supabase.co");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const response = await GET(new Request("https://loja/media/foto.jpg"), {
      params: Promise.resolve({ path: ["..", "secrets"] }),
    });
    expect(response.status).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
