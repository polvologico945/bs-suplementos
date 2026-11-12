import { setTimeout as delay } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readPublicCatalog } from "../lib/catalog-server";
import { GET } from "../app/api/catalog/route";
import { CatalogReadError, networkDiagnostic } from "../lib/catalog-errors";
import { demoCategories, demoProducts, demoSettings } from "../lib/demo-data";

const KEY = "sb_publishable_TEST_NO_PRODUCTION_CREDENTIAL";
let responses: Record<
  string,
  { data?: unknown; status?: number; code?: string }
>;
let legacyColumns: boolean;
type MockFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;
let fetcher: ReturnType<typeof vi.fn<MockFetch>>;
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://loja.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  legacyColumns = false;
  responses = {
    store_settings: { data: demoSettings },
    categories: { data: demoCategories },
    product_types: { data: [] },
    products: { data: demoProducts },
    brands: { data: [] },
  };
  fetcher = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    const resource = url.pathname.split("/").at(-1)!;
    const value = responses[resource];
    if (
      legacyColumns &&
      resource === "products" &&
      url.searchParams.get("select")?.includes("brand_id")
    ) {
      return Response.json(
        { code: "42703", message: "column products.brand_id does not exist" },
        { status: 400 },
      );
    }
    return Response.json(
      value.code
        ? { code: value.code, message: "Mensagem não pública" }
        : value.data,
      { status: value.status || 200 },
    );
  });
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("consultas e diagnóstico do catálogo", () => {
  it("mantém o cache público e cinco consultas quando o schema está atualizado", async () => {
    const response = await GET(new Request("http://localhost/api/catalog"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("max-age=60");
    const data = await response.json();
    expect(data.demo).toBe(false);
    expect(data.products).toHaveLength(demoProducts.length);
    expect(data.diagnostics).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
  it("permite conexão inicial que conclui depois do antigo limite de oito segundos", async () => {
    const respond = fetcher.getMockImplementation()!;
    fetcher.mockImplementation(
      async (input: string | URL | Request, init?: RequestInit) => {
        await delay(8_500, undefined, { signal: init?.signal || undefined });
        return respond(input);
      },
    );
    const data = await readPublicCatalog();
    expect(data.demo).toBe(false);
    expect(data.products).toEqual(demoProducts);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
  it("não derruba produtos reais quando marcas e tipos ainda não foram criados", async () => {
    responses.brands = { status: 404, code: "PGRST205" };
    responses.product_types = { status: 404, code: "PGRST205" };
    const response = await GET(new Request("http://localhost/api/catalog"));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.demo).toBe(false);
    expect(data.products).toEqual(demoProducts);
    expect(data.productTypes).toEqual([]);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(console.warn).toHaveBeenCalled();
  });
  it("consulta os campos legados apenas quando as colunas novas estão ausentes", async () => {
    legacyColumns = true;
    responses.products = {
      data: demoProducts.map((product) =>
        Object.fromEntries(
          Object.entries(product).filter(
            ([field]) =>
              !["brand_id", "product_type_id", "flavors"].includes(field),
          ),
        ),
      ),
    };
    const data = await readPublicCatalog();
    expect(data.products[0]).toMatchObject({
      id: "p-1",
      name: "Bolinhos proteicos",
      brand_id: null,
      product_type_id: null,
      flavors: [],
    });
    expect(data.diagnostics).toEqual([
      expect.objectContaining({
        resource: "products",
        code: "42703",
        reason: "schema",
      }),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(6);
  });
  it("uma falha na tabela essencial continua 503 e nunca vira demonstração", async () => {
    responses.products = { status: 403, code: "42501" };
    const response = await GET(new Request("http://localhost/api/catalog"));
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: "Catálogo temporariamente indisponível.",
    });
    expect(console.error).toHaveBeenCalledWith(expect.any(String), [
      expect.objectContaining({
        resource: "products",
        code: "42501",
        reason: "permissions",
      }),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
  it("em desenvolvimento o JSON explica a causa sem expor a chave", async () => {
    vi.stubEnv("NODE_ENV", "development");
    responses.store_settings = { status: 406, code: "PGRST116" };
    const response = await GET(new Request("http://localhost/api/catalog"));
    const data = await response.json();
    expect(data.diagnostics).toEqual([
      expect.objectContaining({ resource: "store_settings", reason: "data" }),
    ]);
    expect(JSON.stringify(data)).not.toContain(KEY);
  });
  it("identifica DNS no servidor em vez de atribuir a falha ao SQL", async () => {
    fetcher.mockRejectedValue(
      new TypeError(`fetch failed ${KEY}`, { cause: { code: "ENOTFOUND" } }),
    );
    try {
      await readPublicCatalog();
      expect.fail("Esperava falha de rede");
    } catch (error) {
      expect(error).toBeInstanceOf(CatalogReadError);
      const diagnostics = (error as CatalogReadError).diagnostics;
      expect(diagnostics).toHaveLength(3);
      expect(
        diagnostics.every(
          (item) => item.reason === "network" && item.code === "ENOTFOUND",
        ),
      ).toBe(true);
      expect(JSON.stringify(diagnostics)).not.toContain(KEY);
    }
  });
  it("mantém somente dados reais mesmo durante timeout de conexão", async () => {
    fetcher.mockRejectedValue(new DOMException("Timeout", "TimeoutError"));
    vi.stubEnv("NODE_ENV", "development");
    const response = await GET(new Request("http://localhost/api/catalog"));
    const data = await response.json();
    expect(response.status).toBe(503);
    expect(data.diagnostics[0]).toMatchObject({
      code: "SUPABASE_TIMEOUT",
      reason: "timeout",
    });
    expect(data.products).toBeUndefined();
  });
  it("explica URL inválida antes de realizar requisições", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://loja.supabase.co/rest/v1");
    await expect(readPublicCatalog()).rejects.toMatchObject({
      diagnostics: [expect.objectContaining({ code: "SUPABASE_URL_INVALID" })],
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("não usa demonstração quando apenas uma variável está preenchida", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    await expect(readPublicCatalog()).rejects.toMatchObject({
      diagnostics: [expect.objectContaining({ code: "SUPABASE_ENV_MISSING" })],
    });
  });
  it("diferencia certificados do Node.js de problemas de schema", () => {
    expect(
      networkDiagnostic("products", {
        cause: { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" },
      }),
    ).toMatchObject({
      reason: "network",
      hint: expect.stringContaining("certificado"),
    });
  });
});
