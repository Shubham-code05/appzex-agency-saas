import "server-only";
import { ActivityAction } from "./activity";
import type { ClientContext } from "./auth";
import { FEEDBACK_STATUS_META, normalizeFeedbackStatus } from "./feedback";
import { prisma } from "./prisma";

export type TimelineKind = "project" | "task" | "meeting" | "file" | "feedback";

export interface ClientTimelineEvent {
  id: string;
  kind: TimelineKind;
  text: string;
  href: string;
  projectName: string;
  createdAt: Date;
}

function str(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value ? value : null;
}

/**
 * Client-facing activity timeline. Three independent filters keep it safe:
 *  1. Only projects linked to this client (clientId + agencyId).
 *  2. Only log rows flagged `isClientView`.
 *  3. Meeting/file events are dropped unless that item is STILL shared, so
 *     un-sharing something also hides its title from the client's history.
 * Agency staff are shown as the agency, never by internal identity.
 */
export async function getClientTimeline(
  context: ClientContext,
  options: { projectId?: string; take: number },
): Promise<ClientTimelineEvent[]> {
  const projects = await prisma.project.findMany({
    where: {
      clientId: context.clientId,
      agencyId: context.agencyId,
      status: { not: "ARCHIVED" },
      ...(options.projectId ? { id: options.projectId } : {}),
    },
    select: { id: true, name: true },
  });
  if (projects.length === 0) return [];

  const projectIds = projects.map((project) => project.id);
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));

  const [logs, sharedMeetings, sharedFiles] = await Promise.all([
    prisma.activityLog.findMany({
      where: { agencyId: context.agencyId, projectId: { in: projectIds }, isClientView: true },
      orderBy: { createdAt: "desc" },
      take: options.take * 3, // headroom for rows dropped by filter 3
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        projectId: true,
        metadata: true,
        createdAt: true,
        user: { select: { name: true, role: true } },
      },
    }),
    prisma.meeting.findMany({ where: { projectId: { in: projectIds }, isSharedWithClient: true }, select: { id: true } }),
    prisma.fileRecord.findMany({ where: { projectId: { in: projectIds }, isSharedWithClient: true }, select: { id: true } }),
  ]);

  const sharedMeetingIds = new Set(sharedMeetings.map((meeting) => meeting.id));
  const sharedFileIds = new Set(sharedFiles.map((file) => file.id));

  const events: ClientTimelineEvent[] = [];
  for (const log of logs) {
    if (!log.projectId) continue;
    if (log.entityType === "Meeting" && !(log.entityId && sharedMeetingIds.has(log.entityId))) continue;
    if (log.entityType === "File" && !(log.entityId && sharedFileIds.has(log.entityId))) continue;

    const label = str(log.metadata, "label") ?? str(log.metadata, "name") ?? str(log.metadata, "title") ?? "an item";
    const actor = log.user?.role === "CLIENT" ? log.user.name : context.agencyName;
    const projectHref = `/client/projects/${log.projectId}`;
    const feedbackHref = log.entityId ? `/client/feedback/${log.entityId}` : "/client/feedback";

    let event: Omit<ClientTimelineEvent, "id" | "projectName" | "createdAt"> | null = null;
    switch (log.action) {
      case ActivityAction.PROJECT_CREATED:
        event = { kind: "project", text: `${context.agencyName} kicked off the project`, href: projectHref };
        break;
      case ActivityAction.TASK_COMPLETED:
      case ActivityAction.TASK_STATUS_CHANGED:
        event = { kind: "task", text: `Completed: ${label}`, href: projectHref };
        break;
      case ActivityAction.MEETING_CREATED:
      case ActivityAction.MEETING_SHARING_CHANGED:
        event = { kind: "meeting", text: `Meeting shared: ${label}`, href: projectHref };
        break;
      case ActivityAction.FILE_UPLOADED:
      case ActivityAction.FILE_SHARING_CHANGED:
        event = { kind: "file", text: `File shared: ${label}`, href: projectHref };
        break;
      case ActivityAction.FEEDBACK_SUBMITTED:
        event = { kind: "feedback", text: `${actor} submitted “${label}”`, href: feedbackHref };
        break;
      case ActivityAction.FEEDBACK_STATUS_CHANGED: {
        const to = str(log.metadata, "to");
        const status = to ? FEEDBACK_STATUS_META[normalizeFeedbackStatus(to)].label.toLowerCase() : "updated";
        event = { kind: "feedback", text: `“${label}” is now ${status}`, href: feedbackHref };
        break;
      }
      case ActivityAction.FEEDBACK_REPLIED:
        event = { kind: "feedback", text: `${actor} replied on “${label}”`, href: feedbackHref };
        break;
    }
    if (!event) continue;

    events.push({ ...event, id: log.id, projectName: projectNames.get(log.projectId) ?? "", createdAt: log.createdAt });
    if (events.length >= options.take) break;
  }
  return events;
}
