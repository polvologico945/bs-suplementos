"use client";
import Link from "next/link";
import { Check, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CatalogImage } from "@/components/catalog-image";
import { createClient } from "@/lib/supabase/client";
import { establishRecovery } from "@/lib/auth/recovery-session";
import {
  parseRecoveryLink,
  passwordProblem,
  RECOVERY_PATH,
} from "@/lib/auth/recovery-link";

const EXPIRED =
  "Este link expirou ou já foi usado. Solicite um novo link abaixo.";
type InitialState = { userId: string | null; error: string };

export function PasswordRecovery() {
  const [view, setView] = useState<"checking" | "request" | "edit" | "success">(
    "checking",
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const initial = useRef<Promise<InitialState> | null>(null);

  useEffect(() => {
    let active = true;
    if (!initial.current) {
      const link = parseRecoveryLink(new URL(window.location.href));
      // Retira códigos/tokens do histórico antes de carregar a sessão. A Promise
      // compartilhada evita consumir um link duas vezes no Strict Mode do React.
      // Data: 2026-11-12. @author Carla Evelyn
      window.history.replaceState(window.history.state, "", RECOVERY_PATH);
      initial.current = (async (): Promise<InitialState> => {
        if (link.kind === "none") return { userId: null, error: "" };
        if (link.kind === "invalid") return { userId: null, error: EXPIRED };
        try {
          const client = createClient({ detectSessionInUrl: false });
          if (!client)
            return {
              userId: null,
              error:
                "A recuperação não está disponível no momento. Tente novamente mais tarde.",
            };
          const id = await establishRecovery(client, link);
          return { userId: id, error: id ? "" : EXPIRED };
        } catch {
          return {
            userId: null,
            error:
              "Não foi possível validar o link. Confira a conexão ou solicite outro.",
          };
        }
      })();
    }
    initial.current.then((result) => {
      if (!active) return;
      setUserId(result.userId);
      setError(result.error);
      setView(result.userId ? "edit" : "request");
    });
    return () => {
      active = false;
    };
  }, []);

  async function requestEmail(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSent(false);
    try {
      const client = createClient({ detectSessionInUrl: false });
      if (!client) throw new Error();
      const { error: failure } = await client.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: new URL(RECOVERY_PATH, window.location.origin).href,
        },
      );
      if (failure) {
        setError(
          failure.status === 429 ||
            failure.code === "over_email_send_rate_limit"
            ? "Aguarde alguns minutos antes de pedir outro link."
            : "Não foi possível enviar o link. Tente novamente em instantes.",
        );
        return;
      }
      setSent(true);
    } catch {
      setError(
        "Não foi possível conectar. Verifique sua conexão e tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const invalid = passwordProblem(password, confirmation);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const client = createClient({ detectSessionInUrl: false });
      if (!client || !userId) throw new Error();
      const verified = await client.auth.getUser();
      if (verified.error || verified.data.user?.id !== userId) {
        setView("request");
        setUserId(null);
        setPassword("");
        setConfirmation("");
        setError(EXPIRED);
        return;
      }
      // A senha vai diretamente ao Supabase Auth; não é gravada nas tabelas do
      // catálogo, em logs ou em localStorage. Data: 2026-11-12. @author Carla Evelyn
      const { error: failure } = await client.auth.updateUser({ password });
      if (failure) {
        if (
          failure.status === 401 ||
          failure.status === 403 ||
          failure.code === "session_not_found"
        ) {
          setView("request");
          setUserId(null);
          setPassword("");
          setConfirmation("");
          setError(EXPIRED);
        } else
          setError(
            failure.code === "same_password"
              ? "Escolha uma senha diferente da anterior."
              : failure.code === "weak_password"
                ? "Escolha uma senha mais forte, com letras, números e símbolos."
                : "Não foi possível atualizar a senha. Tente novamente em instantes.",
          );
        return;
      }
      setPassword("");
      setConfirmation("");
      setUserId(null);
      setView("success");
      // O login seguinte confirma o uso da nova senha. Falha de logout depois da
      // gravação não deve informar que a alteração da senha falhou.
      await client.auth.signOut({ scope: "local" }).catch(() => {});
    } catch {
      setError(
        "Não foi possível conectar. Verifique sua conexão e tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login recovery-shell">
      <section
        className="login-card recovery-card"
        aria-labelledby="recovery-title"
      >
        <CatalogImage
          src="/brand/logo-card.jpg"
          alt="BS Suplementos"
          width={64}
          height={64}
          loading="eager"
        />
        <div
          className={`recovery-emblem ${view === "success" ? "complete" : ""}`}
          aria-hidden="true"
        >
          {view === "success" ? <Check /> : <KeyRound />}
        </div>
        <span className="recovery-eyebrow">ACESSO DA LOJA</span>
        <h1 id="recovery-title">
          {view === "success"
            ? "Senha atualizada"
            : view === "edit"
              ? "Criar nova senha"
              : "Alterar senha"}
        </h1>
        <p>
          {view === "success"
            ? "Sua nova senha foi salva. Use-a para entrar no painel da loja."
            : view === "edit"
              ? "Escolha uma senha segura para o seu acesso."
              : "Receba um link por e-mail para cadastrar uma nova senha."}
        </p>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {view === "checking" && <p role="status">Validando seu link…</p>}
        {view === "request" && (
          <form className="auth-form" onSubmit={requestEmail}>
            <label>
              E-mail
              <input
                type="email"
                required
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setSent(false);
                }}
                disabled={busy}
              />
            </label>
            {sent && (
              <div className="auth-notice" role="status">
                <Mail size={20} />
                <span>
                  Se houver uma conta associada a este e-mail, você receberá um
                  link para alterar a senha. Confira também o spam.
                </span>
              </div>
            )}
            <button className="auth-submit" disabled={busy || sent}>
              {busy
                ? "Enviando…"
                : sent
                  ? "Link solicitado"
                  : "Enviar link de recuperação"}
            </button>
          </form>
        )}
        {view === "edit" && (
          <form className="auth-form" onSubmit={savePassword}>
            <label>
              Nova senha
              <input
                type="password"
                required
                minLength={12}
                maxLength={72}
                autoComplete="new-password"
                aria-describedby="password-help"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
              />
            </label>
            <p id="password-help" className="password-help">
              Use uma senha longa, com pelo menos 12 caracteres.
            </p>
            <label>
              Confirmar nova senha
              <input
                type="password"
                required
                minLength={12}
                maxLength={72}
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                disabled={busy}
              />
            </label>
            <button className="auth-submit" disabled={busy}>
              {busy ? "Salvando…" : "Salvar nova senha"}
            </button>
          </form>
        )}
        {view === "success" && (
          <Link
            href="/admin/login"
            prefetch={false}
            className="auth-primary-link"
          >
            Entrar com a nova senha
          </Link>
        )}
        {view !== "success" && (
          <Link href="/admin/login" prefetch={false}>
            ← Voltar ao login
          </Link>
        )}
        <div className="recovery-security">
          <ShieldCheck size={15} /> Recuperação segura do seu acesso
        </div>
      </section>
    </main>
  );
}
