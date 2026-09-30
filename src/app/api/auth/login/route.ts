import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE_NAME, SUPPORT_COOKIE_NAME, sessionCookieOptions, signSessionToken } from "@/lib/jwt";
import { ActivityAction } from "@/lib/activity";
import { resolvePostLoginRedirect } from "@/lib/roles";
import { isSameOriginRequest } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID_CREDENTIALS = "Invalid email or password";

// Compared against when the email doesn't exist, so response timing does not
// reveal which emails are registered.
const dummyHashPromise = bcrypt.hash(randomUUID(), 12);

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return jsonError("Cross-origin request blocked", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON", 400);
  }

  const { email: rawEmail, password, next } = (body ?? {}) as Record<string, unknown>;
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  if (
    !email ||
    email.length > 254 ||
    !EMAIL_PATTERN.test(email) ||
    typeof password !== "string" ||
    password.length === 0 ||
    password.length > 200
  ) {
    return jsonError("Please provide a valid email and password", 400);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
      agencyId: true,
      clientId: true,
      agency: { select: { status: true } },
    },
  });

  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? (await dummyHashPromise));
  if (!user || !passwordMatches) {
    return jsonError(INVALID_CREDENTIALS, 401);
  }

  // Tenant status is checked only after the password is verified, so the
  // suspension notice is never disclosed to someone without valid credentials.
  if (user.role !== "SUPER_ADMIN") {
    if (!user.agencyId || !user.agency) {
      return jsonError("Your account is not linked to an agency", 403);
    }
    if (user.agency.status === "SUSPENDED") {
      return jsonError("Your agency account is suspended", 403);
    }
    if (user.agency.status !== "ACTIVE") {
      return jsonError("Your agency account is inactive", 403);
    }
    if (user.role === "CLIENT" && !user.clientId) {
      return jsonError("Your client account is not linked to a client record", 403);
    }
  }

  const token = await signSessionToken({
    id: user.id,
    email: user.email,
    role: user.role,
    agencyId: user.agencyId,
    name: user.name,
  });

  await prisma.activityLog
    .create({
      data: {
        action: ActivityAction.USER_LOGIN,
        entityType: "User",
        entityId: user.id,
        userId: user.id,
        agencyId: user.agencyId,
        metadata: { userAgent: request.headers.get("user-agent")?.slice(0, 255) ?? null },
      },
    })
    .catch((error: unknown) => console.error("Failed to write login activity log:", error));

  const response = NextResponse.json(
    {
      user: { id: user.id, email: user.email, name: user.name, role: user.role, agencyId: user.agencyId },
      redirectTo: resolvePostLoginRedirect(user.role, next),
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(AUTH_COOKIE_NAME, token, sessionCookieOptions());
  // A fresh login never inherits a previous user's Support Mode.
  response.cookies.set(SUPPORT_COOKIE_NAME, "", sessionCookieOptions(0));
  return response;
}
