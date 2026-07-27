import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Define public paths (all app pages are viewable; APIs handle their own auth)
  const publicPaths = ["/", "/login", "/verify-request", "/error", "/privacy", "/terms",
    "/dashboard", "/tasks", "/goals", "/pillars", "/cycles", "/activity", "/settings", "/premium"];
  const isPublicPath = publicPaths.some(path => pathname === path || pathname.startsWith(path));

  // Allow public paths
  if (isPublicPath) {
    const response = NextResponse.next();
    addSecurityHeaders(response);
    return response;
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

  const response = NextResponse.next();
  addSecurityHeaders(response);
  return response;
}

function addSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-DNS-Prefetch-Control", "on");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
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
