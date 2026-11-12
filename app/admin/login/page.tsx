"use client";

import Link from "next/link";
import { CatalogImage } from "@/components/catalog-image";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setError("Configure as variáveis do Supabase antes de usar o painel.");
      setLoading(false);
      return;
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setError("E-mail ou senha inválidos.");
        return;
      }
      // Navegação completa faz o proxy validar os cookies recém-criados no servidor.
      window.location.assign(new URL("/admin", window.location.origin));
    } catch {
      setError(
        "Não foi possível conectar. Verifique sua conexão e tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-login">
      <form onSubmit={submit} className="login-card">
        <CatalogImage src="/brand/logo-card.jpg" alt="BS Suplementos" />
        <h1>Acesso administrativo</h1>
        <p>Área exclusiva para gerenciamento do catálogo.</p>
        <label>
          E-mail
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button disabled={loading}>{loading ? "Entrando…" : "Entrar"}</button>
        <Link href="/">← Voltar ao catálogo</Link>
      </form>
    </main>
  );
}
