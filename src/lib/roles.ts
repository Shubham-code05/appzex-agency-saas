/**
 * Role + route rules shared by middleware (Edge runtime) and server code.
 * Must stay free of Node-only imports (no Prisma, no bcrypt).
 */

export const ROLES = ["SUPER_ADMIN", "AGENCY_ADMIN", "AGENCY_TEAM", "CLIENT"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export const ROLE_HOME: Record<Role, string> = {
  SUPER_ADMIN: "/super-admin",
  AGENCY_ADMIN: "/agency",
  AGENCY_TEAM: "/agency",
  CLIENT: "/client",
};

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  AGENCY_ADMIN: "Agency Admin",
  AGENCY_TEAM: "Team Member",
  CLIENT: "Client",
};

interface RouteRule {
  prefix: string;
  roles: readonly Role[];
}

export const PROTECTED_ROUTES: readonly RouteRule[] = [
  { prefix: "/super-admin", roles: ["SUPER_ADMIN"] },
  { prefix: "/agency", roles: ["AGENCY_ADMIN", "AGENCY_TEAM"] },
  { prefix: "/client", roles: ["CLIENT"] },
];

/**
 * The workspace a SUPER_ADMIN may enter while in Support Mode. Not listed in
 * PROTECTED_ROUTES roles on purpose: access is granted only by a valid support
 * token (middleware) plus a DB-verified impersonation (lib/auth.ts).
 */
export const SUPPORT_MODE_PREFIX = "/agency";

/** Segment-aware match: "/agency" and "/agency/x" match, "/agencyfoo" does not. */
export function findRouteRule(pathname: string): RouteRule | undefined {
  return PROTECTED_ROUTES.find(
    (rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`),
  );
}

export function canAccessPath(role: Role, pathname: string): boolean {
  const rule = findRouteRule(pathname);
  return rule ? rule.roles.includes(role) : false;
}

/**
 * Resolve a post-login destination. Only same-site, protected paths the role
 * is allowed to visit are honoured; anything else falls back to the role home.
 * Prevents open redirects ("//evil.com", "/\\evil.com", "https://…").
 */
export function resolvePostLoginRedirect(role: Role, next: unknown): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 2048) {
    return ROLE_HOME[role];
  }
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return ROLE_HOME[role];
  }

  let url: URL;
  try {
    url = new URL(next, "http://internal.invalid");
  } catch {
    return ROLE_HOME[role];
  }
  if (url.origin !== "http://internal.invalid") return ROLE_HOME[role];

  return canAccessPath(role, url.pathname) ? `${url.pathname}${url.search}` : ROLE_HOME[role];
}
