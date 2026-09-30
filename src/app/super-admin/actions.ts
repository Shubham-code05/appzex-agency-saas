"use server";

import type { AgencyStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ActivityAction } from "@/lib/activity";
import type { ActionResult } from "@/lib/action-result";
import { AuthError, requireSuperAdmin, type SessionUser } from "@/lib/auth";
import {
  SUPPORT_COOKIE_NAME,
  SUPPORT_TTL_SECONDS,
  sessionCookieOptions,
  signSupportToken,
  verifySupportToken,
} from "@/lib/jwt";
import { prisma } from "@/lib/prisma";

/*
 * Every export here is a public POST endpoint. Arguments come from the browser
 * and are untrusted, so each action (1) re-authorises the caller as SUPER_ADMIN
 * against the database and (2) validates every argument at runtime.
 *
 * `redirect()` works by throwing, so it is always called outside try/catch.
 */

const AGENCY_STATUSES: readonly AgencyStatus[] = ["ACTIVE", "INACTIVE", "SUSPENDED"];
const ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

function isValidId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

function isAgencyStatus(value: unknown): value is AgencyStatus {
  return typeof value === "string" && (AGENCY_STATUSES as readonly string[]).includes(value);
}

function toFailure(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof AuthError) return { ok: false, error: error.message };
  console.error(`[super-admin action] ${fallback}:`, error);
  return { ok: false, error: `${fallback}. Please try again.` };
}

function secondsSince(date: Date): number {
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
}

// ─── updateAgencyStatus ─────────────────────────────────────────────────────

/**
 * Changes an agency's status. SUSPENDED/INACTIVE take effect immediately for
 * every member of the agency: getCurrentUser()/requireUser() re-read the agency
 * status on each request, so open sessions are rejected on their next page load
 * or API call, and new logins are refused by /api/auth/login.
 */
export async function updateAgencyStatus(
  agencyId: string,
  newStatus: AgencyStatus,
): Promise<ActionResult<{ status: AgencyStatus }>> {
  try {
    const admin = await requireSuperAdmin();

    if (!isValidId(agencyId)) return { ok: false, error: "Invalid agency id" };
    if (!isAgencyStatus(newStatus)) return { ok: false, error: "Invalid status" };

    const result = await prisma.$transaction(async (tx) => {
      const agency = await tx.agency.findUnique({
        where: { id: agencyId },
        select: { id: true, name: true, status: true },
      });
      if (!agency) return null;
      if (agency.status === newStatus) return { agency, changed: false };

      await tx.agency.update({ where: { id: agency.id }, data: { status: newStatus } });
      await tx.activityLog.create({
        data: {
          action: ActivityAction.AGENCY_STATUS_CHANGED,
          entityType: "Agency",
          entityId: agency.id,
          agencyId: agency.id,
          userId: admin.id,
          metadata: {
            agencyName: agency.name,
            from: agency.status,
            to: newStatus,
            superAdminEmail: admin.email,
          },
        },
      });
      return { agency, changed: true };
    });

    if (!result) return { ok: false, error: "Agency not found" };

    revalidatePath("/", "layout");

    return {
      ok: true,
      message: result.changed
        ? `${result.agency.name} is now ${newStatus.toLowerCase()}`
        : `${result.agency.name} is already ${newStatus.toLowerCase()}`,
      data: { status: newStatus },
    };
  } catch (error) {
    return toFailure(error, "Could not update agency status");
  }
}

// ─── startImpersonation ─────────────────────────────────────────────────────

/**
 * Enters Support Mode for `agencyId`: issues a short-lived, signed support
 * token bound to this super admin, audits it, then redirects to /agency.
 * Suspended/inactive agencies can still be entered — that is often exactly
 * when support needs to look.
 */
export async function startImpersonation(agencyId: string): Promise<ActionResult> {
  try {
    const admin = await requireSuperAdmin();
    if (!isValidId(agencyId)) return { ok: false, error: "Invalid agency id" };

    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: { id: true, name: true, status: true },
    });
    if (!agency) return { ok: false, error: "Agency not found" };

    const cookieStore = await cookies();
    const previous = await currentSupportSession(cookieStore, admin);

    const token = await signSupportToken({ superAdminId: admin.id, agencyId: agency.id });
    const expiresAt = new Date(Date.now() + SUPPORT_TTL_SECONDS * 1000);

    await prisma.$transaction(async (tx) => {
      // Switching directly from one agency to another closes the first session.
      if (previous && previous.agencyId !== agency.id) {
        const previousAgency = await tx.agency.findUnique({
          where: { id: previous.agencyId },
          select: { id: true, name: true },
        });
        await tx.activityLog.create({
          data: {
            action: ActivityAction.SUPPORT_MODE_ENDED,
            entityType: "Agency",
            entityId: previous.agencyId,
            agencyId: previousAgency?.id ?? null,
            userId: admin.id,
            metadata: {
              reason: "switched_agency",
              agencyName: previousAgency?.name ?? null,
              superAdminEmail: admin.email,
              durationSeconds: secondsSince(previous.startedAt),
            },
          },
        });
      }

      await tx.activityLog.create({
        data: {
          action: ActivityAction.SUPPORT_MODE_STARTED,
          entityType: "Agency",
          entityId: agency.id,
          agencyId: agency.id,
          userId: admin.id,
          metadata: {
            agencyName: agency.name,
            agencyStatus: agency.status,
            superAdminEmail: admin.email,
            expiresAt: expiresAt.toISOString(),
          },
        },
      });
    });

    cookieStore.set(SUPPORT_COOKIE_NAME, token, sessionCookieOptions(SUPPORT_TTL_SECONDS));
  } catch (error) {
    return toFailure(error, "Could not start Support Mode");
  }

  revalidatePath("/", "layout");
  redirect("/agency");
}

// ─── stopImpersonation ──────────────────────────────────────────────────────

/**
 * Exits Support Mode: clears the support cookie unconditionally, audits the
 * exit, and redirects to /super-admin/agencies. Clearing happens even if the
 * audit write fails, so a super admin can always leave a tenant workspace.
 */
export async function stopImpersonation(): Promise<ActionResult> {
  let admin: SessionUser;
  try {
    admin = await requireSuperAdmin();
  } catch (error) {
    return toFailure(error, "Could not exit Support Mode");
  }

  const cookieStore = await cookies();
  const support = await currentSupportSession(cookieStore, admin);
  cookieStore.delete(SUPPORT_COOKIE_NAME);

  if (support) {
    try {
      const agency = await prisma.agency.findUnique({
        where: { id: support.agencyId },
        select: { id: true, name: true },
      });
      await prisma.activityLog.create({
        data: {
          action: ActivityAction.SUPPORT_MODE_ENDED,
          entityType: "Agency",
          entityId: support.agencyId,
          agencyId: agency?.id ?? null,
          userId: admin.id,
          metadata: {
            reason: "manual",
            agencyName: agency?.name ?? null,
            superAdminEmail: admin.email,
            durationSeconds: secondsSince(support.startedAt),
          },
        },
      });
    } catch (error) {
      console.error("[super-admin action] Failed to audit Support Mode exit:", error);
    }
  }

  revalidatePath("/", "layout");
  redirect("/super-admin/agencies");
}

async function currentSupportSession(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  admin: SessionUser,
) {
  const token = cookieStore.get(SUPPORT_COOKIE_NAME)?.value;
  if (!token) return null;
  const support = await verifySupportToken(token);
  return support && support.superAdminId === admin.id ? support : null;
}
