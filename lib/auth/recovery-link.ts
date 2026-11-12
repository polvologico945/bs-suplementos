export const RECOVERY_PATH = "/redefinir-senha";

export type RecoveryLink =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "tokens"; accessToken: string; refreshToken: string }
  | { kind: "code"; code: string; flowId?: string }
  | { kind: "otp"; tokenHash: string };

export function parseRecoveryLink(url: URL): RecoveryLink {
  const fragment = new URLSearchParams(url.hash.slice(1));
  const read = (key: string) => fragment.get(key) || url.searchParams.get(key);
  if (read("error") || read("error_code")) return { kind: "invalid" };
  const code = url.searchParams.get("code");
  if (code && (!read("type") || read("type") === "recovery"))
    return {
      kind: "code",
      code,
      flowId: url.searchParams.get("sb_flow_id") || undefined,
    };
  if (read("type") === "recovery") {
    const accessToken = read("access_token");
    const refreshToken = read("refresh_token");
    if (accessToken && refreshToken)
      return { kind: "tokens", accessToken, refreshToken };
    const tokenHash = read("token_hash");
    if (tokenHash) return { kind: "otp", tokenHash };
    return { kind: "invalid" };
  }
  return { kind: "none" };
}

/**
 * Problema: o botão de recuperação do painel Supabase usa a Site URL e chegava
 * ao catálogo. Encaminha a autorização para a tela correta, sempre na mesma
 * origem, sem iniciar Auth ou consultas de banco nas visitas normais da loja.
 * Data: 2026-11-12. @author Carla Evelyn
 */
export function recoveryTarget(url: URL): string | null {
  if (url.pathname === RECOVERY_PATH) return null;
  const hash = new URLSearchParams(url.hash.slice(1));
  const type = hash.get("type") || url.searchParams.get("type");
  const authLanding = ["/", "/admin/login"].includes(url.pathname);
  const hasAuthError =
    hash.has("error") ||
    hash.has("error_code") ||
    url.searchParams.has("error") ||
    url.searchParams.has("error_code");
  if (
    type !== "recovery" &&
    !(authLanding && (url.searchParams.has("code") || hasAuthError))
  )
    return null;
  return `${RECOVERY_PATH}${url.search}${url.hash}`;
}

export function passwordProblem(
  password: string,
  confirmation: string,
): string | null {
  if (password.trim().length < 12)
    return "Use uma senha com pelo menos 12 caracteres.";
  if (new TextEncoder().encode(password).length > 72)
    return "A senha ficou muito longa. Use uma versão um pouco menor.";
  if (password !== confirmation)
    return "As senhas não coincidem. Confira os dois campos.";
  return null;
}
