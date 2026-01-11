import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  const path = request.nextUrl.pathname;
  const cacheHeader = "s-maxage=600, stale-while-revalidate=1200";

  if (path.startsWith("/api/posts") || path.startsWith("/api/works")) {
    response.headers.set("Cache-Control", cacheHeader);
  }

  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
