import { NextResponse, type NextRequest } from "next/server";
import { authErrorResponse, getAgencyWorkspaceOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractMeetingTasks } from "@/lib/ai/meeting-tasks";
import type { AiErrorResponse, ExtractTasksResponse } from "@/lib/ai/types";
import { meetingSummaryRequestSchema } from "@/lib/validation/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function error(message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json<AiErrorResponse>({ error: message }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/**
 * POST /api/ai/meeting-summary  { projectId, notes }
 *
 * Feature A — meeting notes → reviewable task drafts. Nothing is written to the
 * database here; the user reviews/edits drafts and then calls the
 * createTasksFromAi server action, which re-validates everything.
 *
 * Access: AGENCY_ADMIN / AGENCY_TEAM for their own agency, or a SUPER_ADMIN in
 * Support Mode for the impersonated agency. Clients get 403.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) return error("Cross-origin request blocked", 403);

    const workspace = await getAgencyWorkspaceOrThrow();

    const limit = checkRateLimit(`ai:meeting:${workspace.user.id}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!limit.ok) {
      return error(`Too many AI requests. Try again in ${limit.retryAfterSeconds}s.`, 429, {
        "Retry-After": String(limit.retryAfterSeconds),
      });
    }

    const body = await request.json().catch(() => null);
    const parsed = meetingSummaryRequestSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.issues[0]?.message ?? "Invalid request", 400);

    // Tenant isolation: the project must belong to the caller's (or impersonated) agency.
    const project = await prisma.project.findFirst({
      where: { id: parsed.data.projectId, agencyId: workspace.agencyId },
      select: { name: true },
    });
    if (!project) return error("Project not found", 404);

    const result = await extractMeetingTasks({ notes: parsed.data.notes, projectName: project.name });
    return NextResponse.json<ExtractTasksResponse>(result, { headers: { "Cache-Control": "no-store" } });
  } catch (caught) {
    return authErrorResponse(caught);
  }
}
