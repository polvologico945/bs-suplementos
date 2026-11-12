import { test, expect } from "@playwright/test";
const mock = "http://127.0.0.1:54321";
const NEW_PASSWORD = "Minha senha de teste 2026!";

test.beforeEach(async ({ request }) => {
  await request.get(`${mock}/__reset`);
});

async function requestRecovery(page: import("@playwright/test").Page) {
  await page.goto("/redefinir-senha");
  await page.getByLabel("E-mail").fill("admin@example.test");
  await page
    .getByRole("button", { name: "Enviar link de recuperação" })
    .click();
  await expect(page.getByRole("status")).toContainText("Se houver uma conta");
}

test("login oferece Alterar senha abaixo do campo e a rota é pública", async ({
  page,
}) => {
  await page.goto("/admin/login");
  const link = page.getByRole("link", { name: "Alterar senha", exact: true });
  const box = await page.getByLabel("Senha", { exact: true }).boundingBox();
  const linkBox = await link.boundingBox();
  expect(linkBox!.y).toBeGreaterThanOrEqual(box!.y + box!.height);
  await page.screenshot({ path: "test-results/login-password-link.png" });
  await link.click();
  await expect(page).toHaveURL(/\/redefinir-senha$/);
  await expect(
    page.getByRole("button", { name: "Enviar link de recuperação" }),
  ).toBeVisible();
  await expect(page.getByLabel("Nova senha", { exact: true })).toHaveCount(0);
});

test("e-mail usa a rota da origem atual e conclui o fluxo PKCE com a nova senha", async ({
  page,
  request,
}) => {
  await requestRecovery(page);
  const stats = await (await request.get(`${mock}/__stats`)).json();
  expect(stats.recoveries[0].redirectTo).toMatch(
    /^http:\/\/127\.0\.0\.1:3000\/redefinir-senha/,
  );
  const { url } = await (
    await request.get(`${mock}/__recovery-link?flow=pkce`)
  ).json();
  await page.goto(url);
  await expect(page.getByLabel("Nova senha", { exact: true })).toBeVisible();
  await expect(page).toHaveURL("http://127.0.0.1:3000/redefinir-senha");
  await page.getByLabel("Nova senha", { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel("Confirmar nova senha").fill("Senha diferente 2026!");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page.locator(".recovery-card").getByRole("alert")).toContainText(
    "não coincidem",
  );
  expect(
    (await (await request.get(`${mock}/__stats`)).json()).passwordUpdates,
  ).toBe(0);
  await page.getByLabel("Confirmar nova senha").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(
    page.getByRole("heading", { name: "Senha atualizada" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Entrar com a nova senha" }).click();
  await page.getByLabel("E-mail").fill("admin@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("senha-de-teste");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("E-mail ou senha inválidos.")).toBeVisible();
  await page.getByLabel("Senha", { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Produtos", exact: true }),
  ).toBeVisible();
});

test("link enviado pelo Dashboard chega ao catálogo e abre a nova senha sem consultas do catálogo", async ({
  page,
  request,
}) => {
  const { url } = await (await request.get(`${mock}/__recovery-link`)).json();
  const requests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/catalog")) requests.push(req.url());
  });
  await page.goto(url);
  await expect(page.getByLabel("Nova senha", { exact: true })).toBeVisible();
  await expect(page).toHaveURL("http://127.0.0.1:3000/redefinir-senha");
  expect(requests).toEqual([]);
  await page.getByLabel("Nova senha", { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel("Confirmar nova senha").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(
    page.getByRole("heading", { name: "Senha atualizada" }),
  ).toBeVisible();
  expect(
    (await (await request.get(`${mock}/__stats`)).json()).passwordUpdates,
  ).toBe(1);
});

test("link expirado e código inválido não permitem alterar senha mesmo com sessão anterior", async ({
  page,
  request,
}) => {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill("admin@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("senha-de-teste");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Produtos", exact: true }),
  ).toBeVisible();
  await page.goto("/redefinir-senha?code=invalid-code");
  await expect(page.locator(".recovery-card").getByRole("alert")).toContainText(
    "expirou ou já foi usado",
  );
  await expect(page.getByLabel("Nova senha", { exact: true })).toHaveCount(0);
  await page.goto("/#error=access_denied&error_code=otp_expired");
  await expect(page.locator(".recovery-card").getByRole("alert")).toContainText(
    "expirou ou já foi usado",
  );
  await expect(page).toHaveURL("http://127.0.0.1:3000/redefinir-senha");
  expect(
    (await (await request.get(`${mock}/__stats`)).json()).passwordUpdates,
  ).toBe(0);
});

test("template com TokenHash e limite de envio têm tratamento próprio", async ({
  page,
  request,
}) => {
  await page.goto("/redefinir-senha?token_hash=test-token-hash&type=recovery");
  await expect(page.getByLabel("Nova senha", { exact: true })).toBeVisible();
  await expect(page).toHaveURL("http://127.0.0.1:3000/redefinir-senha");
  await page.goto("/redefinir-senha");
  await request.get(`${mock}/__recovery-limit`);
  await page.getByLabel("E-mail").fill("admin@example.test");
  await page
    .getByRole("button", { name: "Enviar link de recuperação" })
    .click();
  await expect(page.locator(".recovery-card").getByRole("alert")).toContainText(
    "Aguarde alguns minutos",
  );
});

test("página de nova senha funciona em celular e não pode ser cacheada", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { url } = await (
    await request.get(`${mock}/__recovery-link?path=/redefinir-senha`)
  ).json();
  const response = await page.goto(url);
  await expect(page.getByLabel("Nova senha", { exact: true })).toBeVisible();
  expect(response!.headers()["cache-control"]).toContain("no-store");
  expect(response!.headers()["referrer-policy"]).toBe("no-referrer");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/recovery-mobile.png" });
});

test("link de recuperação também funciona quando a loja já está aberta", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Whey Protein" }),
  ).toBeVisible();
  const { url } = await (await request.get(`${mock}/__recovery-link`)).json();
  await page.evaluate((link) => {
    window.location.hash = new URL(link).hash;
  }, url);
  await expect(page.getByLabel("Nova senha", { exact: true })).toBeVisible();
  await expect(page).toHaveURL("http://127.0.0.1:3000/redefinir-senha");
  await page.goto("/redefinir-senha");
  await expect(
    page.getByRole("button", { name: "Enviar link de recuperação" }),
  ).toBeVisible();
  await page.evaluate((link) => {
    window.location.hash = new URL(link).hash;
  }, url);
  await expect(page.getByLabel("Nova senha", { exact: true })).toBeVisible();
});
