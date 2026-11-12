export type CatalogDiagnostic = {
  resource: string;
  code: string;
  reason:
    | "configuration"
    | "schema"
    | "permissions"
    | "network"
    | "timeout"
    | "data"
    | "upstream";
  hint: string;
};

export class CatalogReadError extends Error {
  constructor(public readonly diagnostics: CatalogDiagnostic[]) {
    super("Não foi possível consultar o catálogo no Supabase.");
    this.name = "CatalogReadError";
  }
}

type QueryError = { code?: string; status?: number; message?: string };

/**
 * Problema: um HTTP 503 genérico ocultava se a causa era migração, RLS, chave,
 * DNS, TLS ou timeout. Registra apenas códigos e orientações conhecidas, nunca
 * chaves, cabeçalhos de autenticação, linhas de produtos ou erros brutos.
 * Data: 2026-11-12. @author Carla Evelyn
 */
export function queryDiagnostic(
  resource: string,
  error: QueryError,
  status?: number,
): CatalogDiagnostic {
  const code =
    typeof error.code === "string" && /^[A-Z0-9_]{1,64}$/.test(error.code)
      ? error.code
      : "SUPABASE_QUERY_FAILED";
  if (["42P01", "42703", "PGRST204", "PGRST205"].includes(code)) {
    return {
      resource,
      code,
      reason: "schema",
      hint: "Confira se o supabase/schema.sql atualizado foi executado neste projeto e se o schema público está exposto na Data API.",
    };
  }
  if (code === "PGRST116") {
    return {
      resource,
      code,
      reason: "data",
      hint: "Confira se existe uma configuração da loja com id=1 e se sua política RLS permite leitura pública.",
    };
  }
  if (
    [401, 403].includes(status || error.status || 0) ||
    code === "42501" ||
    code === "42P17" ||
    code.startsWith("PGRST3")
  ) {
    return {
      resource,
      code,
      reason: "permissions",
      hint: "Confira a URL/chave pública do mesmo projeto e as permissões/RLS de leitura. Não use uma chave secreta para contornar o erro.",
    };
  }
  return {
    resource,
    code,
    reason: "upstream",
    hint: "Confira o estado do projeto Supabase e a resposta da Data API para este recurso.",
  };
}

export function networkDiagnostic(
  resource: string,
  error: unknown,
): CatalogDiagnostic {
  const value = error as {
    name?: string;
    code?: string;
    cause?: { code?: string; errors?: { code?: string }[] };
  } | null;
  const rawCode =
    value?.cause?.code || value?.cause?.errors?.[0]?.code || value?.code;
  const timeout =
    ["AbortError", "TimeoutError"].includes(value?.name || "") ||
    /TIMEOUT|TIMEDOUT/.test(rawCode || "");
  const code =
    typeof rawCode === "string" && /^[A-Z0-9_]{1,64}$/.test(rawCode)
      ? rawCode
      : timeout
        ? "SUPABASE_TIMEOUT"
        : "SUPABASE_NETWORK_ERROR";
  const tls = /CERT|SSL|TLS|SELF_SIGNED|LEAF_SIGNATURE/.test(code);
  const dns = ["ENOTFOUND", "EAI_AGAIN"].includes(code);
  return {
    resource,
    code,
    reason: timeout ? "timeout" : "network",
    hint: tls
      ? "O Node.js não validou o certificado HTTPS. Confira certificados do sistema e o proxy da máquina; mantenha a verificação TLS habilitada."
      : dns
        ? "O Node.js não resolveu o endereço do Supabase. Confira a URL e o DNS desta máquina."
        : timeout
          ? "A conexão ao Supabase excedeu o tempo limite. Confira se o projeto está ativo e se a rede do Node.js alcança a URL configurada."
          : "O Node.js não conseguiu conectar ao Supabase. Confira a rede, o proxy e a URL configurada nesta máquina.",
  };
}

export function failureDiagnostics(error: unknown): CatalogDiagnostic[] {
  return error instanceof CatalogReadError
    ? error.diagnostics
    : [
        {
          resource: "catalog",
          code: "CATALOG_UNEXPECTED_ERROR",
          reason: "upstream",
          hint: "Confira a configuração do Supabase e os diagnósticos de conexão.",
        },
      ];
}
