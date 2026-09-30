import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { authErrorResponse, requireUser, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { openObjectStream } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * The permission rule is expressed as a WHERE clause, so an unauthorised file
 * is simply "not found" (404) — its existence is never confirmed.
 *
 *   AGENCY_ADMIN / AGENCY_TEAM → any file in their agency's projects
 *   SUPER_ADMIN                → only files of the agency they are impersonating (Support Mode)
 *   CLIENT                     → only SHARED files of projects linked to their client record
 */
function accessFilter(user: SessionUser): Prisma.FileRecordWhereInput | null {
  switch (user.role) {
    case "AGENCY_ADMIN":
    case "AGENCY_TEAM":
      return user.agencyId ? { project: { agencyId: user.agencyId } } : null;
    case "SUPER_ADMIN":
      return user.impersonation ? { project: { agencyId: user.impersonation.agencyId } } : null;
    case "CLIENT":
      return user.clientId && user.agencyId
        ? { isSharedWithClient: true, project: { clientId: user.clientId, agencyId: user.agencyId } }
        : null;
    default:
      return null;
  }
}

function notFound() {
  return NextResponse.json({ error: "File not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
}

/** RFC 6266 / 5987 Content-Disposition that survives non-ASCII names. */
function contentDisposition(fileName: string): string {
  const fallback = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (!ID_PATTERN.test(id)) return notFound();

    const filter = accessFilter(user);
    if (!filter) return notFound();

    const file = await prisma.fileRecord.findFirst({
      where: { AND: [{ id }, filter] },
      select: { fileName: true, storageKey: true, mimeType: true },
    });
    if (!file) return notFound();

    const object = await openObjectStream(file.storageKey);
    if (!object) {
      console.error(`File ${id} exists in DB but its object is missing: ${file.storageKey}`);
      return notFound();
    }

    return new NextResponse(object.stream, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(object.size),
        // Always a download: uploaded content never renders in the app's origin.
        "Content-Disposition": contentDisposition(file.fileName),
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
