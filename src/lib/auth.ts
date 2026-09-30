import "server-only";
import type { AgencyStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "./prisma";
import { AUTH_COOKIE_NAME, SUPPORT_COOKIE_NAME, verifySessionToken, verifySupportToken } from "./jwt";
import { ROLE_HOME, type Role } from "./roles";
import { SESSION_END_REASONS, type SessionEndReason } from "./session-reasons";

export interface Impersonation {
  agencyId: string;
  agencyName: string;
  agencyStatus: AgencyStatus;
  startedAt: Date;
  expiresAt: Date;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** NULL only for SUPER_ADMIN. */
  agencyId: string | null;
  agencyName: string | null;
  agencyStatus: AgencyStatus | null;
  /** Set only for CLIENT users. */
  clientId: string | null;
  /** Set only for a SUPER_ADMIN currently in Support Mode. */
  impersonation: Impersonation | null;
}

type SessionState =
  | { status: "authenticated"; user: SessionUser }
  | { status: "anonymous" }
  | { status: "blocked"; reason: SessionEndReason };

export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

async function resolveImpersonation(superAdminId: string): Promise<Impersonation | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SUPPORT_COOKIE_NAME)?.value;
  if (!token) return null;

  const support = await verifySupportToken(token);
  if (!support || support.superAdminId !== superAdminId) return null;

  const agency = await prisma.agency.findUnique({
    where: { id: support.agencyId },
    select: { id: true, name: true, status: true },
  });
  if (!agency) return null;

  return {
    agencyId: agency.id,
    agencyName: agency.name,
    agencyStatus: agency.status,
    startedAt: support.startedAt,
    expiresAt: support.expiresAt,
  };
}

/**
 * Resolves the request's session once per request (React `cache()`).
 *
 * The JWT only proves identity. Role, tenant and agency status are re-read from
 * MySQL on every request, so suspending an agency, deleting a user or changing
 * a role takes effect on the very next request, not when the token expires.
 */
const getSessionState = cache(async (): Promise<SessionState> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return { status: "anonymous" };

  const session = await verifySessionToken(token);
  if (!session) return { status: "anonymous" };

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      agencyId: true,
      clientId: true,
      agency: { select: { name: true, status: true } },
    },
  });
  if (!user) return { status: "blocked", reason: "session_ended" };

  // A token minted for one tenant must never be honoured for another.
  if (user.agencyId !== session.agencyId) return { status: "blocked", reason: "session_ended" };

  if (user.role !== "SUPER_ADMIN") {
    if (!user.agencyId || !user.agency) return { status: "blocked", reason: "session_ended" };
    if (user.agency.status === "SUSPENDED") return { status: "blocked", reason: "agency_suspended" };
    if (user.agency.status !== "ACTIVE") return { status: "blocked", reason: "agency_inactive" };
    if (user.role === "CLIENT" && !user.clientId) return { status: "blocked", reason: "session_ended" };
  }

  return {
    status: "authenticated",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      agencyId: user.agencyId,
      agencyName: user.agency?.name ?? null,
      agencyStatus: user.agency?.status ?? null,
      clientId: user.clientId,
      impersonation: user.role === "SUPER_ADMIN" ? await resolveImpersonation(user.id) : null,
    },
  };
});

/** The authenticated user for the current request, or null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const state = await getSessionState();
  return state.status === "authenticated" ? state.user : null;
}

/**
 * For Route Handlers / Server Actions. Throws AuthError:
 *   401 — no valid session
 *   403 — agency suspended/inactive, or role not in `allowedRoles`
 */
export async function requireUser(allowedRoles?: readonly Role[]): Promise<SessionUser> {
  const state = await getSessionState();
  if (state.status === "anonymous") throw new AuthError(401, "Authentication required");
  if (state.status === "blocked") {
    throw new AuthError(state.reason === "session_ended" ? 401 : 403, SESSION_END_REASONS[state.reason]);
  }
  if (allowedRoles && !allowedRoles.includes(state.user.role)) {
    throw new AuthError(403, "You do not have permission to perform this action");
  }
  return state.user;
}

/** Every Super Admin mutation goes through this. */
export async function requireSuperAdmin(): Promise<SessionUser> {
  return requireUser(["SUPER_ADMIN"]);
}

/**
 * Tenant guard. SUPER_ADMIN may access any agency; everyone else only their own.
 * Throws AuthError(401) when unauthenticated and AuthError(403) on a cross-tenant
 * request. Returns the verified user so callers can keep scoping queries with it.
 *
 *   const user = await enforceTenantAccess(params.agencyId);
 */
export async function enforceTenantAccess(requestedAgencyId: string): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === "SUPER_ADMIN") return user;

  if (!requestedAgencyId || !user.agencyId || user.agencyId !== requestedAgencyId) {
    throw new AuthError(403, "Forbidden: you do not have access to this agency");
  }
  return user;
}

/** Converts thrown errors from the guards above into JSON responses. */
export function authErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("Unhandled error in route handler:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/**
 * For Server Components (pages/layouts). Redirects instead of throwing.
 * Blocked sessions go to /login?reason=<code>, where middleware clears the cookie.
 */
export async function requirePageUser(allowedRoles: readonly Role[]): Promise<SessionUser> {
  const state = await getSessionState();
  if (state.status === "anonymous") redirect("/login?reason=session_ended");
  if (state.status === "blocked") redirect(`/login?reason=${state.reason}`);
  if (!allowedRoles.includes(state.user.role)) redirect(ROLE_HOME[state.user.role]);
  return state.user;
}

// ─── Agency workspace (tenant context) ──────────────────────────────────────

export interface AgencyWorkspace {
  user: SessionUser;
  agencyId: string;
  agencyName: string;
  /** True when a SUPER_ADMIN is viewing this workspace via Support Mode. */
  supportMode: boolean;
}

function toAgencyWorkspace(user: SessionUser): AgencyWorkspace | null {
  if ((user.role === "AGENCY_ADMIN" || user.role === "AGENCY_TEAM") && user.agencyId && user.agencyName) {
    return { user, agencyId: user.agencyId, agencyName: user.agencyName, supportMode: false };
  }
  if (user.role === "SUPER_ADMIN" && user.impersonation) {
    return {
      user,
      agencyId: user.impersonation.agencyId,
      agencyName: user.impersonation.agencyName,
      supportMode: true,
    };
  }
  return null;
}

/**
 * Resolves which agency an /agency/* page is scoped to: the member's own agency,
 * or the impersonated agency for a Super Admin in Support Mode. Always scope
 * queries with `workspace.agencyId` — never with a client-supplied id.
 */
export async function requireAgencyWorkspace(): Promise<AgencyWorkspace> {
  const user = await requirePageUser(["AGENCY_ADMIN", "AGENCY_TEAM", "SUPER_ADMIN"]);
  const workspace = toAgencyWorkspace(user);
  if (!workspace) redirect(user.role === "SUPER_ADMIN" ? "/super-admin/agencies" : ROLE_HOME[user.role]);
  return workspace;
}

/**
 * Route Handler / Server Action variant of requireAgencyWorkspace().
 * A Super Admin in Support Mode may act inside the impersonated agency; every
 * such mutation is audited with `viaSupportMode: true` (see agency-actions.ts).
 */
export async function getAgencyWorkspaceOrThrow(): Promise<AgencyWorkspace> {
  const user = await requireUser(["AGENCY_ADMIN", "AGENCY_TEAM", "SUPER_ADMIN"]);
  const workspace = toAgencyWorkspace(user);
  if (!workspace) throw new AuthError(403, "No agency workspace is active for this session");
  return workspace;
}

// ─── Client portal context ──────────────────────────────────────────────────

export interface ClientContext {
  user: SessionUser;
  clientId: string;
  agencyId: string;
  agencyName: string;
  clientName: string;
  companyName: string;
}

/**
 * Resolves the CLIENT user's client record. Both ids come from the verified,
 * DB-refreshed session; the client row is re-read with BOTH clientId and
 * agencyId, so a client record moved to another agency is never honoured.
 */
const loadClientContext = cache(async (user: SessionUser): Promise<ClientContext | null> => {
  if (user.role !== "CLIENT" || !user.clientId || !user.agencyId) return null;
  const client = await prisma.client.findFirst({
    where: { id: user.clientId, agencyId: user.agencyId },
    select: { id: true, name: true, companyName: true, agency: { select: { name: true } } },
  });
  if (!client) return null;
  return {
    user,
    clientId: client.id,
    agencyId: user.agencyId,
    agencyName: client.agency.name,
    clientName: client.name,
    companyName: client.companyName,
  };
});

/** For client-portal pages. Redirects anyone who is not a valid CLIENT. */
export async function requireClientContext(): Promise<ClientContext> {
  const user = await requirePageUser(["CLIENT"]);
  const context = await loadClientContext(user);
  if (!context) redirect("/login?reason=session_ended");
  return context;
}

/** For client-portal Server Actions / Route Handlers. Throws AuthError. */
export async function getClientContextOrThrow(): Promise<ClientContext> {
  const user = await requireUser(["CLIENT"]);
  const context = await loadClientContext(user);
  if (!context) throw new AuthError(403, "Your client account is not linked to a client record");
  return context;
}
