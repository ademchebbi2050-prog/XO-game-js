import { NextRequest, NextResponse } from "next/server";
import { RESERVED_SLUGS, hostLabel } from "@/lib/hosts";

// Routage par hôte, SANS accès DB (edge-safe):
//   app.<domaine>  (ou localhost en dev) -> /app/*        (dashboard, session)
//   <slug>.<domaine>                      -> /shop/* + en-tête x-store-slug
//   www / racine                          -> /app/*
// Locale: cookie "locale" (fr|ar), propagée en en-tête x-locale.
export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const label = hostLabel(host);
  const path = req.nextUrl.pathname;

  const headers = new Headers(req.headers);
  const locale = req.cookies.get("locale")?.value === "ar" ? "ar" : "fr";
  headers.set("x-locale", locale);

  const isAppHost = label === "app" || label === "www" || label === "" ||
    host.startsWith("localhost") || host.startsWith("127.0.0.1");

  let pathname = path;
  if (isAppHost) {
    if (!path.startsWith("/app")) pathname = path === "/" ? "/app" : `/app${path}`;
  } else if (RESERVED_SLUGS.has(label)) {
    if (!path.startsWith("/app")) pathname = path === "/" ? "/app" : `/app${path}`;
  } else {
    headers.set("x-store-slug", label);
    if (!path.startsWith("/shop")) pathname = path === "/" ? "/shop" : `/shop${path}`;
  }

  if (pathname !== path) {
    const url = req.nextUrl.clone();
    url.pathname = pathname;
    return NextResponse.rewrite(url, { request: { headers } });
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|uploads|favicon.ico|.*\\.png$|.*\\.svg$).*)"],
};
