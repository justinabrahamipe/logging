import { auth } from "./auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth } = req;
  const isLoggedIn = !!auth?.user;

  // Define public routes that don't require authentication
  const publicRoutes = ["/login", "/verify-request", "/error"];
  const isPublicRoute = nextUrl.pathname === "/" || publicRoutes.some((route) =>
    nextUrl.pathname.startsWith(route)
  );

  // Define API routes that don't require authentication
  const isAuthApiRoute = nextUrl.pathname.startsWith("/api/auth");

  // Allow access to public routes and auth API routes
  if (isPublicRoute || isAuthApiRoute) {
    return NextResponse.next();
  }

  // Redirect to login if not authenticated
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*|public).*)",
  ],
};
