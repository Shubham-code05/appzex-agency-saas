import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, AuthError, enforceTenantAccess } from "@/lib/auth";
import { deriveProgress } from "@/lib/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/agencies/:agencyId/projects
 *
 * Isolation test endpoint:
 *   - admin@apex.com  → own agencyId  → 200
 *   - admin@apex.com  → Zenith's id   → 403
 *   - superadmin      → any agencyId  → 200
 *   - CLIENT          → only projects for their own client record
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ agencyId: string }> }) {
  try {
    const { agencyId } = await params;
    const user = await enforceTenantAccess(agencyId);

    if (user.role === "CLIENT" && !user.clientId) {
      throw new AuthError(403, "Client account is not linked to a client record");
    }

    const projects = await prisma.project.findMany({
      where: {
        agencyId,
        ...(user.role === "CLIENT" ? { clientId: user.clientId! } : {}),
      },
      select: {
        id: true,
        name: true,
        status: true,
        client: { select: { id: true, name: true } },
        tasks: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      {
        projects: projects.map(({ tasks, ...project }) => ({
          ...project,
          taskCount: tasks.length,
          progress: deriveProgress(tasks),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
