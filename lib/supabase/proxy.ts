import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function createContentSecurityPolicy(): string {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  let supabaseOrigin = "";

  try {
    supabaseOrigin = supabaseUrl
      ? new URL(supabaseUrl).origin
      : "";
  } catch {
    supabaseOrigin = "";
  }

  const isDevelopment =
    process.env.NODE_ENV !== "production";

  const connectSources = [
    "'self'",
    supabaseOrigin,
    ...(isDevelopment
      ? ["ws:", "http:", "https:"]
      : []),
  ].filter(Boolean);

  const directives = [
    "default-src 'self'",

    `script-src 'self' 'unsafe-inline'${
      isDevelopment ? " 'unsafe-eval'" : ""
    }`,

    "style-src 'self' 'unsafe-inline'",

    `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),

    "font-src 'self' data:",

    `connect-src ${connectSources.join(" ")}`,

    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  if (!isDevelopment) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

export async function updateSession(request: NextRequest) {
  const contentSecurityPolicy = createContentSecurityPolicy();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "Content-Security-Policy",
    contentSecurityPolicy,
  );

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set(
    "Content-Security-Policy",
    contentSecurityPolicy,
  );

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const pathname = request.nextUrl.pathname;

  const isAdminRoute =
    pathname.startsWith("/admin") &&
    pathname !== "/admin/login";

  if (!supabaseUrl || !supabaseKey) {
    if (isAdminRoute) {
      return NextResponse.redirect(
        new URL("/admin/login", request.url),
      );
    }

    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });

          response.headers.set(
            "Content-Security-Policy",
            contentSecurityPolicy,
          );

          cookiesToSet.forEach(
            ({ name, value, options }) => {
              response.cookies.set(
                name,
                value,
                options,
              );
            },
          );
        },
      },
    },
  );

  if (!isAdminRoute) {
    await supabase.auth.getUser();
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL(
      "/admin/login",
      request.url,
    );

    loginUrl.searchParams.set("next", pathname);

    return NextResponse.redirect(loginUrl);
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || profile?.role !== "admin") {
    await supabase.auth.signOut();

    return NextResponse.redirect(
      new URL(
        "/admin/login?erro=acesso",
        request.url,
      ),
    );
  }

  return response;
}