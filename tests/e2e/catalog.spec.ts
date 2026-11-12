import { test, expect } from "@playwright/test";
const mock = "http://127.0.0.1:54321";

test.beforeEach(async ({ request }) => {
  await request.get(`${mock}/__reset`);
});
async function addProduct(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Chocolate", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
}

test("foto baixa uma vez ao adicionar, reabrir carrinho e filtrar", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const productImage = page.locator(".product-image img");
  await expect(productImage).toBeVisible();
  await productImage.evaluate((image: HTMLImageElement) => image.decode());
  const before = await (await request.get(`${mock}/__stats`)).json();
  await addProduct(page);
  const dialog = page.getByRole("dialog", { name: "Carrinho", exact: true });
  await expect(dialog.locator("img")).toHaveJSProperty("complete", true);
  const source = await productImage.getAttribute("src");
  expect(await dialog.locator("img").getAttribute("src")).toBe(source);
  for (let index = 0; index < 4; index++) {
    await page.getByRole("button", { name: "Fechar carrinho" }).click();
    await page.getByRole("button", { name: "Abrir carrinho" }).click();
    await expect(dialog.locator("img")).toHaveJSProperty("complete", true);
  }
  await page.keyboard.press("Escape");
  await page
    .getByRole("textbox", { name: "Buscar produto, marca ou categoria" })
    .fill("inexistente");
  await expect(
    page.getByText("Nenhum produto encontrado com esses filtros."),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Buscar produto, marca ou categoria" })
    .fill("Suplementos");
  await expect(productImage).toBeVisible();
  await productImage.evaluate((image: HTMLImageElement) => image.decode());
  const after = await (await request.get(`${mock}/__stats`)).json();
  expect(
    after.requests["/storage/v1/object/public/catalog/products/test.jpg"],
  ).toBe(
    before.requests["/storage/v1/object/public/catalog/products/test.jpg"],
  );
  const timings = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((entry) => entry.name.includes("/media/products/test.jpg"))
      .map((entry) => ({
        transfer: (entry as PerformanceResourceTiming).transferSize,
      })),
  );
  expect(timings.filter((entry) => entry.transfer > 0)).toHaveLength(1);
  expect(errors).toEqual([]);
  await test.info().attach("media-network.json", {
    body: JSON.stringify(
      { before: before.requests, after: after.requests, timings },
      null,
      2,
    ),
    contentType: "application/json",
  });
  await page
    .getByRole("textbox", { name: "Buscar produto, marca ou categoria" })
    .blur();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: "test-results/catalog-desktop.png",
    fullPage: true,
  });
});

test("carrinho migra valores antigos e confere novos preços antes do WhatsApp", async ({
  page,
  request,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "bs-cart",
      JSON.stringify([
        { id: "p-1", flavor: "Chocolate", quantity: 2, price: 1 },
      ]),
    ),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir carrinho" }).click();
  await expect(page.locator(".total")).toContainText("160,00");
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("bs-cart") || "[]"),
  );
  expect(saved).toEqual([{ id: "p-1", flavor: "Chocolate", quantity: 2 }]);
  await request.post(`${mock}/__product`, { data: { promotional_price: 70 } });
  await page.getByRole("button", { name: "Finalizar pedido" }).click();
  await expect(
    page.getByText("Atualizamos preços ou disponibilidade", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Enviar pedido pelo WhatsApp" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Finalizar pedido" }).click();
  const link = page.getByRole("link", { name: "Enviar pedido pelo WhatsApp" });
  await expect(link).toBeVisible();
  const url = new URL((await link.getAttribute("href"))!);
  expect(url.hostname).toBe("wa.me");
  expect(url.searchParams.get("text")).toContain("140,00");
  expect(url.searchParams.get("text")).toContain("Chocolate");
});

test("JSON inválido não quebra catálogo e falhas não mostram produtos fictícios", async ({
  page,
  request,
}) => {
  await page.addInitScript(() => localStorage.setItem("bs-cart", "{invalido"));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Whey Protein" }),
  ).toBeVisible();
  await request.get(`${mock}/__failure?enabled=true`);
  const session = await page.context().newCDPSession(page);
  await session.send("Network.clearBrowserCache");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Catálogo indisponível no momento" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Bolinhos proteicos")).toHaveCount(0);
});

test("catálogo e seleção de sabor cabem na tela do celular", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await addProduct(page);
  await expect(
    page.getByRole("dialog", { name: "Carrinho", exact: true }),
  ).toBeVisible();
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter(
        (element) => element.getBoundingClientRect().right > innerWidth + 1,
      )
      .map((element) => ({
        tag: element.tagName,
        className: element.className,
        width: element.getBoundingClientRect().width,
      })),
  );
  expect(overflow).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/cart-mobile.png",
    fullPage: false,
  });
});

test("admin aceita JPEG e HEIC reais, comprime antes de enviar e salva produto", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill("admin@example.test");
  await page.getByLabel("Senha").fill("senha-de-teste");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Produtos", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Novo produto" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Creatina de teste");
  await page
    .locator('input[type="file"]')
    .setInputFiles("tests/fixtures/product.jpg");
  await expect(page.getByText("Foto pronta:", { exact: false })).toBeVisible({
    timeout: 20_000,
  });
  await page
    .locator('input[type="file"]')
    .setInputFiles("tests/fixtures/iphone.heic");
  await expect(page.getByText("Foto pronta:", { exact: false })).toBeVisible({
    timeout: 40_000,
  });
  await page.getByRole("button", { name: "Salvar produto" }).click();
  await expect(page.getByText("Produto salvo com sucesso!")).toBeVisible();
  const { uploads } = await (await request.get(`${mock}/__stats`)).json();
  expect(uploads).toHaveLength(2);
  for (const upload of uploads) {
    expect(upload.path).toMatch(/\/v2\/[a-f0-9]{64}\.webp$/);
    expect(upload.bytes).toBeLessThanOrEqual(350_000);
    expect(upload.format).toBe("webp");
    expect(upload.exif).toBe(false);
    expect(upload.matchesHash).toBe(true);
    expect(Math.max(upload.width, upload.height)).toBeLessThanOrEqual(1200);
  }
  await test.info().attach("uploads.json", {
    body: JSON.stringify(uploads, null, 2),
    contentType: "application/json",
  });
  expect(errors).toEqual([]);
});
