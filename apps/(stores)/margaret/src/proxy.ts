import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  // Product pages: browser 10min, CDN 1hr, stale-while-revalidate 24hr
  if (pathname === "/products" || pathname.startsWith("/products/")) {
    response.headers.set(
      "Cache-Control",
      "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400",
    );
    response.headers.set("CDN-Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    return response;
  }

  // Home and about pages: browser 10min, CDN 1hr, stale 24hr
  if (pathname === "/" || pathname === "/about") {
    response.headers.set(
      "Cache-Control",
      "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400",
    );
    response.headers.set("CDN-Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    return response;
  }

  return response;
}

export const config = {
  matcher: ["/products/:path*", "/about", "/"],
};
