import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecoveryLink } from "./recovery-link";

/**
 * Problema: o link enviado pelo Dashboard usa tokens, enquanto o cliente SSR usa
 * PKCE. Trata cada formato explicitamente; apenas a sessão validada pelo Supabase
 * libera a nova senha. Um cookie antigo não transforma um link inválido em válido.
 * Data: 2026-11-12. @author Carla Evelyn
 */
export async function establishRecovery(
  client: SupabaseClient,
  link: RecoveryLink,
): Promise<string | null> {
  if (link.kind === "none" || link.kind === "invalid") return null;
  const result =
    link.kind === "tokens"
      ? await client.auth.setSession({
          access_token: link.accessToken,
          refresh_token: link.refreshToken,
        })
      : link.kind === "code"
        ? await client.auth.exchangeCodeForSession(
            link.code,
            link.flowId ? { flowId: link.flowId } : undefined,
          )
        : await client.auth.verifyOtp({
            token_hash: link.tokenHash,
            type: "recovery",
          });
  if (result.error || !result.data.session || !result.data.user) return null;
  const verified = await client.auth.getUser();
  return !verified.error && verified.data.user?.id === result.data.user.id
    ? verified.data.user.id
    : null;
}
