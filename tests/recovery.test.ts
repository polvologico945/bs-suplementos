import { describe, expect, it } from "vitest";
import {
  parseRecoveryLink,
  passwordProblem,
  recoveryTarget,
} from "../lib/auth/recovery-link";

describe("links de recuperação", () => {
  it.each([
    "/",
    "/#produtos",
    "/?utm_source=instagram",
    "/admin/login",
    "/redefinir-senha",
  ])("não inicia recuperação em navegação comum: %s", (path) => {
    expect(
      recoveryTarget(new URL(path, "https://bssuplementos.com.br")),
    ).toBeNull();
  });
  it("encaminha o link do Dashboard à mesma origem preservando a autorização", () => {
    const url = new URL(
      "https://bssuplementos.com.br/#type=recovery&access_token=test-access&refresh_token=test-refresh",
    );
    expect(recoveryTarget(url)).toBe(
      "/redefinir-senha#type=recovery&access_token=test-access&refresh_token=test-refresh",
    );
    expect(parseRecoveryLink(url)).toEqual({
      kind: "tokens",
      accessToken: "test-access",
      refreshToken: "test-refresh",
    });
  });
  it("preserva o identificador do fluxo PKCE e ignora destinos externos", () => {
    const url = new URL(
      "https://bssuplementos.com.br/?code=test-code&sb_flow_id=test-flow&next=https://externo.example",
    );
    expect(recoveryTarget(url)).toMatch(/^\/redefinir-senha\?/);
    expect(parseRecoveryLink(url)).toEqual({
      kind: "code",
      code: "test-code",
      flowId: "test-flow",
    });
  });
  it("aceita TokenHash somente para recuperação e rejeita callbacks incompletos", () => {
    expect(
      parseRecoveryLink(
        new URL("https://loja/redefinir-senha?token_hash=test&type=recovery"),
      ),
    ).toEqual({ kind: "otp", tokenHash: "test" });
    expect(
      parseRecoveryLink(
        new URL("https://loja/redefinir-senha?token_hash=test&type=signup"),
      ),
    ).toEqual({ kind: "none" });
    expect(
      parseRecoveryLink(
        new URL("https://loja/#type=recovery&access_token=test"),
      ),
    ).toEqual({ kind: "invalid" });
  });
  it("prioriza erro do Supabase mesmo se houver tokens na URL", () => {
    expect(
      parseRecoveryLink(
        new URL(
          "https://loja/#error=access_denied&error_code=otp_expired&type=recovery&access_token=test&refresh_token=test",
        ),
      ),
    ).toEqual({ kind: "invalid" });
  });
});

describe("nova senha", () => {
  it("valida confirmação, comprimento e limite de caracteres multibyte", () => {
    expect(passwordProblem("muito-curta", "muito-curta")).toContain(
      "12 caracteres",
    );
    expect(
      passwordProblem("Minha nova senha 2026!", "outra senha diferente"),
    ).toContain("coincidem");
    expect(passwordProblem("á".repeat(40), "á".repeat(40))).toContain("longa");
    expect(
      passwordProblem("Minha nova senha 2026!", "Minha nova senha 2026!"),
    ).toBeNull();
  });
});
