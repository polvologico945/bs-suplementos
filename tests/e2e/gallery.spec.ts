import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
const mock = "http://127.0.0.1:54321";
const photo = (name: string) =>
  `${mock}/storage/v1/object/public/catalog/products/gallery-${name}.jpg`;
const front = photo("front"),
  back = photo("back"),
  detail = photo("detail");

test.beforeEach(async ({ request }) => {
  await request.get(`${mock}/__reset`);
});
async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill("admin@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("senha-de-teste");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Produtos", exact: true }),
  ).toBeVisible();
}
async function decoded(page: Page, selector: string) {
  await page
    .locator(selector)
    .evaluate((image: HTMLImageElement) => image.decode());
}

test("galeria baixa somente fotos escolhidas e reutiliza os bytes ao reabrir e abrir carrinho", async ({
  page,
  request,
}) => {
  await request.post(`${mock}/__product`, {
    data: { image_url: front, image_urls: [front, back, detail] },
  });
  const photos: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/media/products/gallery-")) photos.push(req.url());
  });
  await page.goto("/");
  await decoded(page, ".product-image img");
  expect(photos).toHaveLength(1);
  const open = page.getByRole("button", {
    name: "Ver 3 fotos de Whey Protein",
  });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "Fotos de Whey Protein" });
  await expect(dialog).toBeVisible();
  await decoded(page, ".gallery-photo img");
  expect(photos.filter((url) => url.endsWith("gallery-back.jpg"))).toHaveLength(
    0,
  );
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("status")).toHaveText("Foto 2 de 3");
  await decoded(page, ".gallery-photo img");
  expect(photos.some((url) => url.endsWith("gallery-detail.jpg"))).toBe(false);
  await dialog.getByRole("button", { name: "Ver foto 3 de 3" }).click();
  await decoded(page, ".gallery-photo img");
  await page.keyboard.press("Home");
  await expect(dialog.getByRole("status")).toHaveText("Foto 1 de 3");
  await page.keyboard.press("Escape");
  await expect(open).toBeFocused();
  for (let i = 0; i < 2; i++) {
    await open.click();
    await dialog.getByRole("button", { name: "Ver foto 2 de 3" }).click();
    await decoded(page, ".gallery-photo img");
    await page.keyboard.press("Escape");
  }
  await page
    .getByRole("button", { name: "Adicionar Whey Protein ao carrinho" })
    .click();
  await page.getByRole("button", { name: "Chocolate", exact: true }).click();
  await page
    .getByRole("button", { name: "Adicionar ao carrinho", exact: true })
    .click();
  await decoded(page, ".cart-thumb img");
  const transfers = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((entry) => entry.name.includes("/media/products/gallery-"))
      .map((entry) => ({
        url: entry.name,
        bytes: (entry as PerformanceResourceTiming).transferSize,
      })),
  );
  for (const suffix of [
    "gallery-front.jpg",
    "gallery-back.jpg",
    "gallery-detail.jpg",
  ])
    expect(
      transfers.filter(
        (entry) => entry.url.endsWith(suffix) && entry.bytes > 0,
      ),
    ).toHaveLength(1);
  const stats = await (await request.get(`${mock}/__stats`)).json();
  expect(stats.requests["/auth/v1/user"]).toBeUndefined();
  await test.info().attach("gallery-network.json", {
    body: JSON.stringify(transfers, null, 2),
    contentType: "application/json",
  });
});

test("capa troca suavemente, permite pausar e para fora da tela", async ({
  page,
  request,
}) => {
  await request.post(`${mock}/__settings`, {
    data: { hero_image_url: front, hero_image_urls: [front, back, detail] },
  });
  await page.clock.install();
  await page.goto("/");
  await page.mouse.move(0, 0);
  const position = page.locator(".hero-photo-position");
  await expect(position).toHaveAttribute("aria-live", "off");
  await expect(page.locator(".hero-slide")).toHaveCount(1);
  await page.clock.runFor(6600);
  await expect(position).toHaveText("Foto 2 de 3");
  await expect(page.locator(".hero-slide")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Pausar apresentação da capa" })
    .click();
  await page.mouse.move(0, 0);
  await page.clock.runFor(14000);
  await expect(position).toHaveText("Foto 2 de 3");
  await page.getByRole("button", { name: "Próxima foto da capa" }).click();
  await expect(position).toHaveText("Foto 3 de 3");
  await page
    .getByRole("button", { name: "Reproduzir apresentação da capa" })
    .click();
  await page.mouse.move(0, 0);
  await page.clock.runFor(6600);
  await expect(position).toHaveText("Foto 1 de 3");
  await page.evaluate(() =>
    window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }),
  );
  await expect
    .poll(() =>
      page
        .locator("#inicio")
        .evaluate((element) => element.getBoundingClientRect().bottom),
    )
    .toBeLessThanOrEqual(0);
  await expect(position).toHaveAttribute("aria-live", "polite");
  await page.clock.runFor(14000);
  await expect(position).toHaveText("Foto 1 de 3");
});

test("menos movimento e economia de dados desativam a troca automática sem impedir navegação", async ({
  page,
  request,
}) => {
  await request.post(`${mock}/__settings`, {
    data: { hero_image_urls: [front, back] },
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto("/");
  const position = page.locator(".hero-photo-position");
  await expect(position).toHaveText("Foto 1 de 2");
  await page.clock.runFor(20000);
  await expect(page.locator(".hero-slide")).toHaveCount(1);
  await expect(page.locator(".hero-playback")).toHaveCount(0);
  await page.getByRole("button", { name: "Próxima foto da capa" }).click();
  await expect(position).toHaveText("Foto 2 de 2");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: Object.assign(new EventTarget(), { saveData: true }),
    }),
  );
  await page.reload();
  await expect(position).toHaveText("Foto 1 de 2");
  await page.clock.runFor(20000);
  await expect(page.locator(".hero-slide")).toHaveCount(1);
  await expect(page.locator(".hero-playback")).toHaveCount(0);
});

test("atalho para produtos, filtros anunciados e foco isolado na galeria pelo teclado", async ({
  page,
  request,
}) => {
  await request.post(`${mock}/__product`, {
    data: { image_urls: [front, back] },
  });
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Pular para os produtos" }),
  ).toBeAttached();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Pular para os produtos" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#produtos")).toBeFocused();
  const categories = page.getByRole("group", { name: "Filtrar por categoria" });
  await expect(
    categories.getByRole("button", { name: "Todos" }),
  ).toHaveAttribute("aria-pressed", "true");
  await categories.getByRole("button", { name: "Suplementos" }).click();
  await expect(
    categories.getByRole("button", { name: "Suplementos" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("textbox", { name: "Buscar produto, marca ou categoria" })
    .fill("nada");
  await expect(page.locator(".catalog-result-count")).toHaveText(
    "0 produtos encontrados",
  );
  await page
    .getByRole("textbox", { name: "Buscar produto, marca ou categoria" })
    .fill("");
  const open = page.getByRole("button", {
    name: "Ver 2 fotos de Whey Protein",
  });
  await open.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Fotos de Whey Protein" });
  await expect(
    dialog.getByRole("button", { name: "Fechar galeria" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "Ver foto 2 de 2" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Fechar galeria" }),
  ).toBeFocused();
  expect(
    await page
      .locator(".topbar")
      .evaluate((element) => (element as HTMLElement).inert),
  ).toBe(true);
  await page.keyboard.press("End");
  await expect(dialog.getByRole("status")).toHaveText("Foto 2 de 2");
  await page.keyboard.press("Escape");
  await expect(open).toBeFocused();
  expect(
    await page
      .locator(".topbar")
      .evaluate((element) => (element as HTMLElement).inert),
  ).toBe(false);
});

test("galeria em celular aceita gesto, mantém controles acessíveis e não estoura a tela", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await request.post(`${mock}/__product`, {
    data: { image_urls: [front, back, detail] },
  });
  await request.post(`${mock}/__settings`, {
    data: { hero_image_urls: [front, back] },
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Ver 3 fotos de Whey Protein" })
    .click();
  const target = page.locator(".gallery-photo");
  await target.dispatchEvent("pointerdown", {
    pointerType: "touch",
    clientX: 300,
    clientY: 300,
  });
  await target.dispatchEvent("pointerup", {
    pointerType: "touch",
    clientX: 80,
    clientY: 305,
  });
  await expect(page.getByRole("dialog").getByRole("status")).toHaveText(
    "Foto 2 de 3",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const button of await page
    .locator(".gallery-navigation button, .gallery-positions button")
    .all()) {
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: "test-results/gallery-mobile.png" });
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: "test-results/hero-gallery-mobile.png",
    fullPage: false,
  });
});

test("painel envia várias fotos JPEG/HEIC, evita repetidas, ordena, remove e salva a principal", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  await login(page);
  await page.getByRole("button", { name: "Novo produto" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Produto com galeria");
  const input = page.getByLabel("Fotos do produto", { exact: true });
  await input.setInputFiles([
    "tests/fixtures/product.jpg",
    "tests/fixtures/iphone.heic",
    "tests/fixtures/product.jpg",
  ]);
  await expect(
    page.getByText("Fotos prontas: 2 adicionadas", { exact: false }),
  ).toBeVisible({ timeout: 40000 });
  const list = page.locator(".admin-gallery-list");
  await expect(list.locator("li")).toHaveCount(2);
  const second = await list.locator("li img").nth(1).getAttribute("src");
  await page
    .getByRole("button", { name: "Usar foto 2 como principal" })
    .click();
  await expect(list.locator("li img").first()).toHaveAttribute("src", second!);
  await page.getByRole("button", { name: "Remover foto 2" }).click();
  await page.getByRole("button", { name: "Salvar produto" }).click();
  await expect(page.getByText("Produto salvo com sucesso!")).toBeVisible();
  const rows = await (await request.get(`${mock}/rest/v1/products`)).json();
  const saved = rows.find(
    (row: { name: string }) => row.name === "Produto com galeria",
  );
  expect(saved.image_urls).toHaveLength(1);
  expect(saved.image_url).toBe(saved.image_urls[0]);
  expect(saved.image_url).toContain(second!.replace("/media/", "/catalog/"));
  const { uploads } = await (await request.get(`${mock}/__stats`)).json();
  expect(uploads).toHaveLength(2);
  expect(
    uploads.every(
      (upload: { format: string; bytes: number }) =>
        upload.format === "webp" && upload.bytes <= 350000,
    ),
  ).toBe(true);
});

test("painel preserva envios concluídos quando uma foto falha e salva as fotos da capa", async ({
  page,
  request,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Aparência e loja" }).click();
  await page.getByLabel("Fotos da capa", { exact: true }).setInputFiles([
    {
      name: "foto-invalida.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("imagem inválida"),
    },
    {
      name: "foto-valida.jpg",
      mimeType: "image/jpeg",
      buffer: await readFile("tests/fixtures/product.jpg"),
    },
  ]);
  await expect(
    page.locator(".image-gallery-upload").getByRole("alert"),
  ).toContainText("foto-invalida.jpg");
  await expect(page.locator(".admin-gallery-list li")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Usar foto 2 como principal" })
    .click();
  await page.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.getByText("Configurações salvas.")).toBeVisible();
  const [settings] = await (
    await request.get(`${mock}/rest/v1/store_settings`)
  ).json();
  expect(settings.hero_image_urls).toHaveLength(2);
  expect(settings.hero_image_url).toBe(settings.hero_image_urls[0]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/gallery-admin-mobile.png",
    fullPage: true,
  });
});
