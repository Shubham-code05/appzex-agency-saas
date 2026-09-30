/**
 * Session token primitives. Edge-safe (uses `jose` + Web Crypto only), so it
 * is imported by both middleware and Node route handlers.
 */
import { jwtVerify, SignJWT } from "jose";
import { isRole, type Role } from "./roles";

export const AUTH_COOKIE_NAME = "auth_token";
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

const JWT_ALG = "HS256";
const JWT_ISSUER = "appzex";
const JWT_AUDIENCE = "appzex:web";

export interface SessionPayload {
  id: string;
  email: string;
  role: Role;
  /** NULL only for SUPER_ADMIN. */
  agencyId: string | null;
  name: string;
}

let cachedKey: Uint8Array | null = null;

function getSecretKey(): Uint8Array {
  if (cachedKey) return cachedKey;
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET is missing or shorter than 32 characters.");
  }
  cachedKey = new TextEncoder().encode(secret);
  return cachedKey;
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    id: payload.id,
    email: payload.email,
    role: payload.role,
    agencyId: payload.agencyId,
    name: payload.name,
  })
    .setProtectedHeader({ alg: JWT_ALG, typ: "JWT" })
    .setSubject(payload.id)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

/** Returns the verified payload, or null for any invalid/expired/tampered token. */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: [JWT_ALG],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    const { id, email, role, agencyId, name } = payload;
    if (
      typeof id !== "string" ||
      id !== payload.sub ||
      typeof email !== "string" ||
      typeof name !== "string" ||
      !isRole(role) ||
      !(agencyId === null || typeof agencyId === "string")
    ) {
      return null;
    }
    // Structural tenant invariant: only SUPER_ADMIN may be tenant-less.
    if (role !== "SUPER_ADMIN" && !agencyId) return null;

    return { id, email, role, agencyId, name };
  } catch {
    return null;
  }
}

// ─── Support mode (Super Admin impersonation) ───────────────────────────────
//
// A separate, short-lived token bound to one super admin + one agency. It uses
// its own audience so it can never be replayed as a session token (or vice
// versa), and it grants nothing on its own: middleware and getCurrentUser()
// only honour it alongside a valid SUPER_ADMIN session with the same user id.

export const SUPPORT_COOKIE_NAME = "support_session";
export const SUPPORT_TTL_SECONDS = 60 * 60; // 1 hour
const SUPPORT_AUDIENCE = "appzex:support";

export interface SupportSessionPayload {
  superAdminId: string;
  agencyId: string;
  startedAt: Date;
  expiresAt: Date;
}

export async function signSupportToken(input: { superAdminId: string; agencyId: string }): Promise<string> {
  return new SignJWT({ agencyId: input.agencyId })
    .setProtectedHeader({ alg: JWT_ALG, typ: "JWT" })
    .setSubject(input.superAdminId)
    .setIssuer(JWT_ISSUER)
    .setAudience(SUPPORT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SUPPORT_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySupportToken(token: string): Promise<SupportSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: [JWT_ALG],
      issuer: JWT_ISSUER,
      audience: SUPPORT_AUDIENCE,
    });
    const { sub, agencyId, iat, exp } = payload;
    if (typeof sub !== "string" || !sub || typeof agencyId !== "string" || !agencyId) return null;
    if (typeof iat !== "number" || typeof exp !== "number") return null;

    return {
      superAdminId: sub,
      agencyId,
      startedAt: new Date(iat * 1000),
      expiresAt: new Date(exp * 1000),
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge: number = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
