// ═══════════════════════════════════════════════════════════════
// NovaCal — Next.js Middleware
// Source: docs/05-route-map-web-mobile.md §1 (Auth) + §2 (Dashboard)
//
// Session token check:
//   - Validates the Better Auth session cookie.
//   - Redirects / → /calendar if authenticated.
//   - Renders auth UI if not authenticated.
//   - Protects dashboard/settings/admin/developer routes.
//   - Forwards X-Workspace-Id header to route handlers.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─── Route Groups ───

/** Routes that require authentication (all sub-paths included). */
const PROTECTED_ROUTES = [
  "/calendar",
  "/agenda",
  "/search",
  "/settings",
  "/admin",
  "/developer",
  "/w/",
];

/** Auth-related routes that should only be accessed by unauthenticated users. */
const AUTH_ROUTES = ["/login", "/setup"];

/** Public routes accessible without authentication. */
const PUBLIC_ROUTES = ["/p/", "/e/", "/api/health"];

// ─── Helper: Check if path matches any prefix ───

function pathMatchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname.startsWith(prefix));
}

// ─── Middleware ───

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Skip middleware for static assets and Next.js internals ──
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/health")
  ) {
    return NextResponse.next();
  }

  // ── Extract session cookie ──
  // Better Auth stores the session token in a cookie named "better-auth.session_token"
  // or "better-auth.session_token" (in production, with __Secure- prefix).
  const sessionCookie =
    request.cookies.get("better-auth.session_token")?.value ??
    request.cookies.get("__Secure-better-auth.session_token")?.value;

  const isAuthenticated = !!sessionCookie;

  // ── Root route: redirect based on auth state ──
  if (pathname === "/") {
    if (isAuthenticated) {
      // Authenticated → go to calendar
      return NextResponse.redirect(new URL("/calendar", request.url));
    }
    // Unauthenticated → render auth UI (the root page layout handles this)
    return NextResponse.next();
  }

  // ── Auth routes: redirect to calendar if already authenticated ──
  if (pathMatchesPrefix(pathname, AUTH_ROUTES)) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/calendar", request.url));
    }
    return NextResponse.next();
  }

  // ── Protected routes: require authentication ──
  if (pathMatchesPrefix(pathname, PROTECTED_ROUTES)) {
    if (!isAuthenticated) {
      // Not authenticated → redirect to login
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Public routes: always allow ──
  if (pathMatchesPrefix(pathname, PUBLIC_ROUTES)) {
    return NextResponse.next();
  }

  // ── Forward X-Workspace-Id header ──
  // If the request has an X-Workspace-Id header, ensure it's propagated
  // to the downstream route handler for workspace-scoped operations.
  const response = NextResponse.next();
  const workspaceId = request.headers.get("X-Workspace-Id");

  if (workspaceId) {
    response.headers.set("X-Workspace-Id", workspaceId);
  }

  // ── For API routes, add CORS headers ──
  if (pathname.startsWith("/api/")) {
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Workspace-Id, X-Idempotency-Key",
    );
  }

  return response;
}

// ─── Matcher ───
// Only run on specific paths to avoid unnecessary invocations.
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot)).*)",
  ],
};
