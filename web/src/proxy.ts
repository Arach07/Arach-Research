import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";

// Odświeża sesję Supabase i wpuszcza tylko zalogowanego użytkownika.
export async function proxy(request: NextRequest) {
  const url = supabaseUrl;
  const key = supabaseKey;

  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !key && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ].filter(Boolean);
  if (missing.length > 0) {
    return new NextResponse(
      `Brak zmiennych środowiskowych: ${missing.join(", ")}. ` +
        "Dodaj je w Vercel (Settings → Environments) i zrób Redeploy.",
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url!)) {
    return new NextResponse(
      "NEXT_PUBLIC_SUPABASE_URL ma zły format — powinien wyglądać jak https://xxxx.supabase.co\n" +
        `Apka dostała: ${JSON.stringify(url)}`,
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    url!,
    key!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims weryfikuje podpis tokenu lokalnie (klucze asymetryczne) — bez zapytania do serwera
  // Supabase przy każdym kliknięciu; przy starszym typie kluczy sam odpyta serwer jak getUser()
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  // Pomija pliki statyczne, ikony, manifest PWA, service worker (powiadomienia)
  // i adres, przez który n8n zleca wysłanie powiadomień (ma własne hasło, patrz api/push/wyslij)
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-192.png|icon-512.png|apple-icon.png|manifest.webmanifest|sw.js|api/push/wyslij).*)",
  ],
};
