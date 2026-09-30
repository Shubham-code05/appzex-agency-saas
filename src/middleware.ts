import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, SUPPORT_COOKIE_NAME, verifySessionToken, verifySupportToken } from "@/lib/jwt";
import { findRouteRule, ROLE_HOME, SUPPORT_MODE_PREFIX } from "@/lib/roles";
import { isSessionEndReason } from "@/lib/session-reasons";

/**
 * Edge gatekeeper: verifies JWT signatures and enforces role → route-prefix
 * rules. It cannot reach the database, so it is a first line of defence only —
 * every page, route handler and server action must still call the guards in
 * lib/auth.ts, which re-check user, role and agency status against MySQL.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (pathname === "/login") {
    // A server-side check ended the session (e.g. agency suspended mid-session):
    // drop the cookies and show the form instead of bouncing back to the dashboard.
    if (isSessionEndReason(request.nextUrl.searchParams.get("reason"))) {
      return clearAuthCookies(NextResponse.next(), request);
    }
    if (session) {
      return NextResponse.redirect(new URL(ROLE_HOME[session.role], request.url));
    }
    return clearAuthCookies(NextResponse.next(), request); // invalid/expired token
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(session ? ROLE_HOME[session.role] : "/login", request.url));
  }

  const rule = findRouteRule(pathname);
  if (!rule) return NextResponse.next();

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return clearAuthCookies(NextResponse.redirect(loginUrl), request);
  }

  if (!rule.roles.includes(session.role)) {
    // Support Mode: a Super Admin may enter the agency workspace only with a
    // valid support token issued to *this* super admin.
    if (session.role === "SUPER_ADMIN" && rule.prefix === SUPPORT_MODE_PREFIX) {
      const supportToken = request.cookies.get(SUPPORT_COOKIE_NAME)?.value;
      const support = supportToken ? await verifySupportToken(supportToken) : null;
      if (support && support.superAdminId === session.id) return noStore(NextResponse.next());

      const response = NextResponse.redirect(new URL("/super-admin/agencies", request.url));
      if (supportToken) response.cookies.delete(SUPPORT_COOKIE_NAME);
      return response;
    }
    return NextResponse.redirect(new URL(ROLE_HOME[session.role], request.url));
  }

  return noStore(NextResponse.next());
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function clearAuthCookies(response: NextResponse, request: NextRequest): NextResponse {
  if (request.cookies.has(AUTH_COOKIE_NAME)) response.cookies.delete(AUTH_COOKIE_NAME);
  if (request.cookies.has(SUPPORT_COOKIE_NAME)) response.cookies.delete(SUPPORT_COOKIE_NAME);
  return response;
}

export const config = {
  matcher: ["/", "/login", "/super-admin/:path*", "/agency/:path*", "/client/:path*"],
};
