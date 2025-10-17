import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Define public paths
  const publicPaths = ["/", "/login", "/verify-request", "/error", "/privacy", "/terms"];
  const isPublicPath = publicPaths.some(path => pathname === path || pathname.startsWith(path));

  // Allow public paths
  if (isPublicPath) {
    return NextResponse.next();
  }

  // Check for session token
  const sessionToken = request.cookies.get("authjs.session-token") ||
                      request.cookies.get("__Secure-authjs.session-token");

  // Redirect to login if no session
  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api routes (handled by NextAuth)
     * - public assets
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)",
  ],
};
