import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ActivityAction } from "@/lib/activity";
import {
  AUTH_COOKIE_NAME,
  SUPPORT_COOKIE_NAME,
  sessionCookieOptions,
  verifySessionToken,
  verifySupportToken,
} from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST only (never GET) so a third-party page can't log users out via an <img>.
 * Responds with 303 → /login, which works for both <form method="post"> and fetch().
 * Signing out while in Support Mode also ends (and audits) the support session.
 */
export async function POST(request: NextRequest) {
  await auditSupportModeExitOnLogout(request).catch((error: unknown) =>
    console.error("Failed to audit support mode exit on logout:", error),
  );

  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(AUTH_COOKIE_NAME, "", sessionCookieOptions(0));
  response.cookies.set(SUPPORT_COOKIE_NAME, "", sessionCookieOptions(0));
  response.headers.set("Cache-Control", "no-store");
  return response;
}

async function auditSupportModeExitOnLogout(request: NextRequest): Promise<void> {
  const sessionToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const supportToken = request.cookies.get(SUPPORT_COOKIE_NAME)?.value;
  if (!sessionToken || !supportToken) return;

  const [session, support] = await Promise.all([
    verifySessionToken(sessionToken),
    verifySupportToken(supportToken),
  ]);
  if (!session || session.role !== "SUPER_ADMIN" || !support || support.superAdminId !== session.id) return;

  const agency = await prisma.agency.findUnique({ where: { id: support.agencyId }, select: { id: true, name: true } });

  await prisma.activityLog.create({
    data: {
      action: ActivityAction.SUPPORT_MODE_ENDED,
      entityType: "Agency",
      entityId: support.agencyId,
      agencyId: agency?.id ?? null,
      userId: session.id,
      metadata: {
        reason: "logout",
        agencyName: agency?.name ?? null,
        superAdminEmail: session.email,
        durationSeconds: Math.max(0, Math.round((Date.now() - support.startedAt.getTime()) / 1000)),
      },
    },
  });
}
