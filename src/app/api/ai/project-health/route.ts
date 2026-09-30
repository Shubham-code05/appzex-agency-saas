import { NextResponse, type NextRequest } from "next/server";
import { authErrorResponse, getAgencyWorkspaceOrThrow } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { assessProjectHealth, collectHealthMetrics } from "@/lib/ai/project-health";
import type { AiErrorResponse, ProjectHealthResponse } from "@/lib/ai/types";
import { projectHealthRequestSchema } from "@/lib/validation/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function error(message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json<AiErrorResponse>({ error: message }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/**
 * POST /api/ai/project-health  { projectId }
 *
 * Feature B — RAG health assessment. Metrics are gathered server-side with
 * agency-scoped queries (collectHealthMetrics), so the model only ever sees
 * facts from the caller's own project. Read-only: nothing is written.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) return error("Cross-origin request blocked", 403);

    const workspace = await getAgencyWorkspaceOrThrow();

    const limit = checkRateLimit(`ai:health:${workspace.user.id}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!limit.ok) {
      return error(`Too many AI requests. Try again in ${limit.retryAfterSeconds}s.`, 429, {
        "Retry-After": String(limit.retryAfterSeconds),
      });
    }

    const body = await request.json().catch(() => null);
    const parsed = projectHealthRequestSchema.safeParse(body);
    if (!parsed.success) return error("Invalid project id", 400);

    const metrics = await collectHealthMetrics(workspace.agencyId, parsed.data.projectId);
    if (!metrics) return error("Project not found", 404);

    const result = await assessProjectHealth(metrics);
    return NextResponse.json<ProjectHealthResponse>(result, { headers: { "Cache-Control": "no-store" } });
  } catch (caught) {
    return authErrorResponse(caught);
  }
}
