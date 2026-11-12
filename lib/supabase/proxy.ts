import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Problema: requisições públicas renovavam sessões e imagens acionavam o proxy.
 * Autenticação só é executada nas páginas administrativas; cookies de renovação e
 * logout também são preservados nos redirecionamentos. RLS segue sendo a barreira
 * de escrita no banco. Data: 2026-11-12. @author Carla Evelyn */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const redirect = (path: string) => {
    const result = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
    result.headers.set("Cache-Control", "private, no-store");
    return result;
  };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (request.nextUrl.pathname === "/admin/login") return response;
  if (!url || !key) return redirect("/admin/login");
  const db = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  try {
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return redirect("/admin/login");
    const { data: profile, error } = await db
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (error || profile?.role !== "admin") {
      await db.auth.signOut();
      return redirect("/admin/login?erro=acesso");
    }
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return redirect("/admin/login?erro=conexao");
  }
}
