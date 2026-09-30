"use server";

import { Prisma, type TaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActivityAction, type ActivityActionName } from "@/lib/activity";
import type { ActionResult } from "@/lib/action-result";
import { AuthError, getAgencyWorkspaceOrThrow, type AgencyWorkspace } from "@/lib/auth";
import { canTransition, FEEDBACK_STATUS_META, normalizeFeedbackStatus, type FeedbackStatusValue } from "@/lib/feedback";
import { prisma } from "@/lib/prisma";
import { deriveProgress } from "@/lib/progress";
import { discardUpload, getOptionalFile, storeUpload, UploadError, type StoredUpload } from "@/lib/uploads";
import { feedbackReviewSchema, uploadFileSchema } from "@/lib/validation/portal";
import { createTasksFromAiSchema } from "@/lib/validation/ai";
import type { AiTaskDraft } from "@/lib/ai/types";
import { startOfUtcDay } from "@/lib/dates";
import {
  createClientSchema,
  createMeetingSchema,
  createProjectSchema,
  createTaskSchema,
  formDataToObject,
  idSchema,
  taskStatusSchema,
  toFieldErrors,
} from "@/lib/validation/agency";

/*
 * Tenant-isolation contract for every action in this file:
 *
 *  1. The tenant is resolved ONLY from the verified session via
 *     getAgencyWorkspaceOrThrow() — the member's own agency, or the impersonated
 *     agency for a Super Admin in Support Mode. No action accepts an agencyId
 *     from the client.
 *  2. Every referenced record (client, project, task, meeting, assignee) is
 *     looked up with `agencyId` in the WHERE clause inside the same transaction
 *     as the write. A foreign id is indistinguishable from a missing one
 *     ("not found"), so ids from other tenants cannot even be probed.
 *  3. Every mutation writes an ActivityLog row; Support Mode writes are flagged.
 */

type Tx = Prisma.TransactionClient;

class NotFoundError extends Error {}

const AGENCY_MEMBER_ROLES = ["AGENCY_ADMIN", "AGENCY_TEAM"] as const;

function toFailure(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof AuthError) return { ok: false, error: error.message };
  if (error instanceof NotFoundError) return { ok: false, error: error.message };
  if (error instanceof UploadError) return { ok: false, error: error.message };
  console.error(`[agency action] ${fallback}:`, error);
  return { ok: false, error: `${fallback}. Please try again.` };
}

function validationFailure(error: z.ZodError): { ok: false; error: string; fieldErrors: ReturnType<typeof toFieldErrors> } {
  return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: toFieldErrors(error) };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

interface ActivityEntry {
  action: ActivityActionName;
  entityType: string;
  entityId: string;
  /** Set for project-scoped events (drives per-project timelines). */
  projectId?: string;
  /** true → also shown in the client portal timeline. Default false (internal). */
  isClientView?: boolean;
  metadata: Record<string, unknown>;
}

async function logActivity(tx: Tx, workspace: AgencyWorkspace, entry: ActivityEntry): Promise<void> {
  await tx.activityLog.create({
    data: {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      projectId: entry.projectId ?? null,
      isClientView: entry.isClientView ?? false,
      agencyId: workspace.agencyId,
      userId: workspace.user.id,
      metadata: {
        ...entry.metadata,
        ...(workspace.supportMode ? { viaSupportMode: true, actorEmail: workspace.user.email } : {}),
      } as Prisma.InputJsonObject,
    },
  });
}

async function findOwnedProject(tx: Tx, workspace: AgencyWorkspace, projectId: string) {
  const project = await tx.project.findFirst({
    where: { id: projectId, agencyId: workspace.agencyId },
    select: { id: true, name: true },
  });
  if (!project) throw new NotFoundError("Project not found");
  return project;
}

function revalidateAgency(projectId?: string): void {
  revalidatePath("/agency", "layout");
  // Client-portal pages render the same data (progress, shared items, timeline).
  revalidatePath("/client", "layout");
  if (projectId) revalidatePath(`/agency/projects/${projectId}`);
}

// ─── createClient ───────────────────────────────────────────────────────────

export async function createClient(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const workspace = await getAgencyWorkspaceOrThrow();

    const parsed = createClientSchema.safeParse(formDataToObject(formData, ["name", "companyName", "contactEmail"]));
    if (!parsed.success) return validationFailure(parsed.error);
    const input = parsed.data;

    const client = await prisma.$transaction(async (tx) => {
      const created = await tx.client.create({
        data: { ...input, agencyId: workspace.agencyId },
        select: { id: true, name: true, companyName: true },
      });
      await logActivity(tx, workspace, {
        action: ActivityAction.CLIENT_CREATED,
        entityType: "Client",
        entityId: created.id,
        metadata: { label: created.companyName },
      });
      return created;
    });

    revalidateAgency();
    return { ok: true, message: `${client.companyName} was added`, data: { id: client.id } };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        error: "A client with this contact email already exists in your agency.",
        fieldErrors: { contactEmail: ["Already used by another client"] },
      };
    }
    return toFailure(error, "Could not create client");
  }
}

// ─── createProject ──────────────────────────────────────────────────────────

export async function createProject(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const workspace = await getAgencyWorkspaceOrThrow();

    const parsed = createProjectSchema.safeParse(
      formDataToObject(formData, ["name", "description", "clientId", "status", "startDate", "dueDate"]),
    );
    if (!parsed.success) return validationFailure(parsed.error);
    const input = parsed.data;

    const project = await prisma.$transaction(async (tx) => {
      // The client must belong to this agency — never trust the submitted id.
      const client = await tx.client.findFirst({
        where: { id: input.clientId, agencyId: workspace.agencyId },
        select: { id: true, companyName: true },
      });
      if (!client) throw new NotFoundError("Selected client was not found");

      const created = await tx.project.create({
        data: {
          name: input.name,
          description: input.description,
          status: input.status,
          startDate: input.startDate,
          endDate: input.dueDate,
          agencyId: workspace.agencyId,
          clientId: client.id,
        },
        select: { id: true, name: true },
      });
      await logActivity(tx, workspace, {
        action: ActivityAction.PROJECT_CREATED,
        entityType: "Project",
        entityId: created.id,
        projectId: created.id,
        isClientView: true,
        metadata: { label: created.name, clientName: client.companyName },
      });
      return created;
    });

    revalidateAgency(project.id);
    return { ok: true, message: `${project.name} was created`, data: { id: project.id } };
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { ok: false, error: error.message, fieldErrors: { clientId: [error.message] } };
    }
    return toFailure(error, "Could not create project");
  }
}

// ─── createTask ─────────────────────────────────────────────────────────────

export async function createTask(formData: FormData): Promise<ActionResult<{ id: string; progress: number }>> {
  try {
    const workspace = await getAgencyWorkspaceOrThrow();

    const parsed = createTaskSchema.safeParse(
      formDataToObject(formData, ["projectId", "title", "description", "priority", "status", "dueDate", "assigneeId"]),
    );
    if (!parsed.success) return validationFailure(parsed.error);
    const input = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const project = await findOwnedProject(tx, workspace, input.projectId);

      if (input.assigneeId) {
        // Assignees must be staff of the SAME agency (not clients, not other tenants).
        const assignee = await tx.user.findFirst({
          where: { id: input.assigneeId, agencyId: workspace.agencyId, role: { in: [...AGENCY_MEMBER_ROLES] } },
          select: { id: true },
        });
        if (!assignee) throw new NotFoundError("Selected assignee was not found");
      }

      const task = await tx.task.create({
        data: {
          title: input.title,
          description: input.description,
          priority: input.priority,
          status: input.status,
          dueDate: input.dueDate,
          assigneeId: input.assigneeId,
          projectId: project.id,
        },
        select: { id: true, title: true },
      });
      await logActivity(tx, workspace, {
        action: ActivityAction.TASK_CREATED,
        entityType: "Task",
        entityId: task.id,
        projectId: project.id,
        metadata: { label: task.title, projectId: project.id, projectName: project.name },
      });

      const statuses = await tx.task.findMany({ where: { projectId: project.id }, select: { status: true } });
      return { task, projectId: project.id, progress: deriveProgress(statuses) };
    });

    revalidateAgency(result.projectId);
    return { ok: true, message: "Task created", data: { id: result.task.id, progress: result.progress } };
  } catch (error) {
    if (error instanceof NotFoundError && error.message.includes("assignee")) {
      return { ok: false, error: error.message, fieldErrors: { assigneeId: [error.message] } };
    }
    return toFailure(error, "Could not create task");
  }
}

// ─── updateTaskStatus ───────────────────────────────────────────────────────

export async function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
): Promise<ActionResult<{ status: TaskStatus; progress: number }>> {
  try {
    const workspace = await getAgencyWorkspaceOrThrow();

    const id = idSchema.safeParse(taskId);
    const status = taskStatusSchema.safeParse(newStatus);
    if (!id.success) return { ok: false, error: "Invalid task id" };
    if (!status.success) return { ok: false, error: "Invalid task status" };

    const result = await prisma.$transaction(async (tx) => {
      // Ownership is enforced through the parent project's agencyId.
      const task = await tx.task.findFirst({
        where: { id: id.data, project: { agencyId: workspace.agencyId } },
        select: { id: true, title: true, status: true, projectId: true, project: { select: { name: true } } },
      });
      if (!task) throw new NotFoundError("Task not found");

      if (task.status !== status.data) {
        await tx.task.update({ where: { id: task.id }, data: { status: status.data } });
        await logActivity(tx, workspace, {
          action: ActivityAction.TASK_STATUS_CHANGED,
          entityType: "Task",
          entityId: task.id,
          projectId: task.projectId,
          // Clients see completions only, never internal reshuffles.
          isClientView: status.data === "DONE",
          metadata: {
            label: task.title,
            projectId: task.projectId,
            projectName: task.project.name,
            from: task.status,
            to: status.data,
          },
        });
      }

      const statuses = await tx.task.findMany({ where: { projectId: task.projectId }, select: { status: true } });
      return { projectId: task.projectId, progress: deriveProgress(statuses) };
    });

    revalidateAgency(result.projectId);
    return {
      ok: true,
      message: "Task updated",
      data: { status: status.data, progress: result.progress },
    };
  } catch (error) {
    return toFailure(error, "Could not update task");
  }
}

// ─── createMeeting ──────────────────────────────────────────────────────────

export async function createMeeting(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const workspace = await getAgencyWorkspaceOrThrow();

    const parsed = createMeetingSchema.safeParse(
      formDataToObject(formData, [
        "projectId",
        "title",
        "scheduledAt",
        "durationMinutes",
        "notes",
        "meetingUrl",
        "isSharedWithClient",
      ]),
    );
    if (!parsed.success) return validationFailure(parsed.error);
    const input = parsed.data;

    const meeting = await prisma.$transaction(async (tx) => {
      const project = await findOwnedProject(tx, workspace, input.projectId);

      const created = await tx.meeting.create({
        data: {
          title: input.title,
          scheduledAt: input.scheduledAt,
          durationMinutes: input.durationMinutes,
          notes: input.notes,
          meetingUrl: input.meetingUrl,
          isSharedWithClient: input.isSharedWithClient,
          projectId: project.id,
          // A support-mode super admin is not an agency member; don't record them as organizer.
          organizerId: workspace.supportMode ? null : workspace.user.id,
        },
        select: { id: true, title: true, projectId: true },
      });
      await logActivity(tx, workspace, {
        action: ActivityAction.MEETING_CREATED,
        entityType: "Meeting",
        entityId: created.id,
        projectId: project.id,
        isClientView: input.isSharedWithClient,
        metadata: {
          label: created.title,
          projectId: project.id,
          projectName: project.name,
          isSharedWithClient: input.isSharedWithClient,
        },
      });
      return created;
    });

    revalidateAgency(meeting.projectId);
    return { ok: true, message: "Meeting scheduled", data: { id: meeting.id } };
  } catch (error) {
    return toFailure(error, "Could not schedule meeting");
  }
}

// ─── updateMeetingSharing ───────────────────────────────────────────────────

export async function updateMeetingSharing(
  meetingId: string,
  isSharedWithClient: boolean,
): Promise<ActionResult<{ isSharedWithClient: boolean }>> {
  try {
    const workspace = await getAgencyWorkspaceOrThrow();

    const id = idSchema.safeParse(meetingId);
    if (!id.success) return { ok: false, error: "Invalid meeting id" };
    if (typeof isSharedWithClient !== "boolean") return { ok: false, error: "Invalid sharing value" };

    const projectId = await prisma.$transaction(async (tx) => {
      const meeting = await tx.meeting.findFirst({
        where: { id: id.data, project: { agencyId: workspace.agencyId } },
        select: { id: true, title: true, isSharedWithClient: true, projectId: true, project: { select: { name: true } } },
      });
      if (!meeting) throw new NotFoundError("Meeting not found");

      if (meeting.isSharedWithClient !== isSharedWithClient) {
        await tx.meeting.update({ where: { id: meeting.id }, data: { isSharedWithClient } });
        await logActivity(tx, workspace, {
          action: ActivityAction.MEETING_SHARING_CHANGED,
          entityType: "Meeting",
          entityId: meeting.id,
          projectId: meeting.projectId,
          isClientView: isSharedWithClient,
          metadata: {
            label: meeting.title,
            projectId: meeting.projectId,
            projectName: meeting.project.name,
            isSharedWithClient,
          },
        });
      }
      return meeting.projectId;
    });

    revalidateAgency(projectId);
    return {
      ok: true,
      message: isSharedWithClient ? "Meeting is now visible to the client" : "Meeting is now internal only",
      data: { isSharedWithClient },
    };
  } catch (error) {
    return toFailure(error, "Could not update meeting");
  }
}

// ─── updateFeedbackStatus ───────────────────────────────────────────────────

class WorkflowError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
  }
}

/**
 * Agency review of a client change request: moves it through the workflow
 * and/or posts an official reply to the client. At least one must change.
 * Declining requires a reply so the client always learns why.
 */
export async function updateFeedbackStatus(
  feedbackId: string,
  newStatus: FeedbackStatusValue,
  replyText: string,
): Promise<ActionResult<{ status: FeedbackStatusValue }>> {
  try {
    const workspace = await getAgencyWorkspaceOrThrow();

    const parsed = feedbackReviewSchema.safeParse({ feedbackId, status: newStatus, replyText });
    if (!parsed.success) return validationFailure(parsed.error);
    const input = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      // Ownership via the parent project's agency.
      const feedback = await tx.feedback.findFirst({
        where: { id: input.feedbackId, project: { agencyId: workspace.agencyId } },
        select: { id: true, title: true, content: true, status: true, projectId: true },
      });
      if (!feedback) throw new NotFoundError("Feedback not found");

      const current = normalizeFeedbackStatus(feedback.status);
      const statusChanged = current !== input.status;

      if (statusChanged && !canTransition(current, input.status)) {
        throw new WorkflowError(
          `A request can't move from ${FEEDBACK_STATUS_META[current].label} to ${FEEDBACK_STATUS_META[input.status].label}.`,
          "status",
        );
      }
      if (statusChanged && input.status === "DECLINED" && !input.replyText) {
        throw new WorkflowError("Add a reply explaining why the request is declined.", "replyText");
      }
      if (!statusChanged && !input.replyText) {
        throw new WorkflowError("Change the status or write a reply first.", "replyText");
      }

      await tx.feedbackMessage.create({
        data: {
          feedbackId: feedback.id,
          authorId: workspace.user.id,
          body: input.replyText,
          fromStatus: statusChanged ? current : null,
          toStatus: statusChanged ? input.status : null,
        },
      });
      // Always touch updatedAt so threads sort by latest activity.
      await tx.feedback.update({
        where: { id: feedback.id },
        data: { status: input.status, updatedAt: new Date() },
      });

      await logActivity(tx, workspace, {
        action: statusChanged ? ActivityAction.FEEDBACK_STATUS_CHANGED : ActivityAction.FEEDBACK_REPLIED,
        entityType: "Feedback",
        entityId: feedback.id,
        projectId: feedback.projectId,
        isClientView: true,
        metadata: {
          label: feedback.title || feedback.content.slice(0, 80),
          ...(statusChanged ? { from: current, to: input.status } : {}),
          replied: Boolean(input.replyText),
        },
      });
      return { projectId: feedback.projectId, feedbackId: feedback.id, statusChanged };
    });

    revalidateAgency(result.projectId);
    revalidatePath(`/agency/feedback/${result.feedbackId}`);
    revalidatePath(`/client/feedback/${result.feedbackId}`);
    return {
      ok: true,
      message: result.statusChanged ? `Status updated to ${FEEDBACK_STATUS_META[input.status].label}` : "Reply sent",
      data: { status: input.status },
    };
  } catch (error) {
    if (error instanceof WorkflowError) {
      return { ok: false, error: error.message, fieldErrors: error.field ? { [error.field]: [error.message] } : undefined };
    }
    return toFailure(error, "Could not update feedback");
  }
}

// ─── toggleFileSharing ──────────────────────────────────────────────────────

export async function toggleFileSharing(
  fileId: string,
  isShared: boolean,
): Promise<ActionResult<{ isSharedWithClient: boolean }>> {
  try {
    const workspace = await getAgencyWorkspaceOrThrow();

    const id = idSchema.safeParse(fileId);
    if (!id.success) return { ok: false, error: "Invalid file id" };
    if (typeof isShared !== "boolean") return { ok: false, error: "Invalid sharing value" };

    const file = await prisma.$transaction(async (tx) => {
      const found = await tx.fileRecord.findFirst({
        where: { id: id.data, project: { agencyId: workspace.agencyId } },
        select: { id: true, fileName: true, isSharedWithClient: true, projectId: true, feedbackId: true },
      });
      if (!found) throw new NotFoundError("File not found");

      if (found.isSharedWithClient !== isShared) {
        await tx.fileRecord.update({ where: { id: found.id }, data: { isSharedWithClient: isShared } });
        await logActivity(tx, workspace, {
          action: ActivityAction.FILE_SHARING_CHANGED,
          entityType: "File",
          entityId: found.id,
          projectId: found.projectId,
          isClientView: isShared,
          metadata: { label: found.fileName, isSharedWithClient: isShared },
        });
      }
      return found;
    });

    revalidateAgency(file.projectId);
    if (file.feedbackId) {
      revalidatePath(`/agency/feedback/${file.feedbackId}`);
      revalidatePath(`/client/feedback/${file.feedbackId}`);
    }
    return {
      ok: true,
      message: isShared ? "File is now visible to the client" : "File is now internal only",
      data: { isSharedWithClient: isShared },
    };
  } catch (error) {
    return toFailure(error, "Could not update file");
  }
}

// ─── uploadProjectFile ──────────────────────────────────────────────────────

/**
 * Uploads a file to a project, optionally attached to one of that project's
 * tasks or feedback items. Project ownership is verified BEFORE anything is
 * written to storage; the task/feedback must belong to the same project.
 */
export async function uploadProjectFile(formData: FormData): Promise<ActionResult<{ id: string }>> {
  let stored: StoredUpload | null = null;
  try {
    const workspace = await getAgencyWorkspaceOrThrow();

    const parsed = uploadFileSchema.safeParse(
      formDataToObject(formData, ["projectId", "taskId", "feedbackId", "isSharedWithClient"]),
    );
    if (!parsed.success) return validationFailure(parsed.error);
    const input = parsed.data;

    const file = getOptionalFile(formData, "file");
    if (!file) return { ok: false, error: "Choose a file to upload.", fieldErrors: { file: ["Choose a file"] } };

    const project = await prisma.project.findFirst({
      where: { id: input.projectId, agencyId: workspace.agencyId },
      select: { id: true },
    });
    if (!project) throw new NotFoundError("Project not found");

    try {
      stored = await storeUpload(file, { agencyId: workspace.agencyId, projectId: project.id });
    } catch (error) {
      if (error instanceof UploadError) return { ok: false, error: error.message, fieldErrors: { file: [error.message] } };
      throw error;
    }
    const upload = stored;

    const record = await prisma.$transaction(async (tx) => {
      if (input.taskId) {
        const task = await tx.task.findFirst({ where: { id: input.taskId, projectId: project.id }, select: { id: true } });
        if (!task) throw new NotFoundError("Selected task was not found in this project");
      }
      if (input.feedbackId) {
        const feedback = await tx.feedback.findFirst({
          where: { id: input.feedbackId, projectId: project.id },
          select: { id: true },
        });
        if (!feedback) throw new NotFoundError("Feedback item was not found in this project");
      }

      const created = await tx.fileRecord.create({
        data: {
          ...upload,
          isSharedWithClient: input.isSharedWithClient,
          projectId: project.id,
          taskId: input.taskId,
          feedbackId: input.feedbackId,
          uploadedById: workspace.user.id,
        },
        select: { id: true, fileName: true },
      });
      await logActivity(tx, workspace, {
        action: ActivityAction.FILE_UPLOADED,
        entityType: "File",
        entityId: created.id,
        projectId: project.id,
        isClientView: input.isSharedWithClient,
        metadata: { label: created.fileName, isSharedWithClient: input.isSharedWithClient },
      });
      return created;
    });
    stored = null; // committed: keep the object

    revalidateAgency(project.id);
    if (input.feedbackId) {
      revalidatePath(`/agency/feedback/${input.feedbackId}`);
      revalidatePath(`/client/feedback/${input.feedbackId}`);
    }
    return { ok: true, message: `${record.fileName} uploaded`, data: { id: record.id } };
  } catch (error) {
    await discardUpload(stored);
    return toFailure(error, "Could not upload file");
  }
}

// ─── createTasksFromAi ──────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/**
 * Batch-creates tasks from human-reviewed AI drafts (meeting notes → tasks).
 * The drafts come from the browser, so they are re-validated here exactly like
 * manual input; the project is re-checked against the caller's agency.
 */
export async function createTasksFromAi(
  projectId: string,
  tasks: AiTaskDraft[],
): Promise<ActionResult<{ count: number; progress: number }>> {
  try {
    const workspace = await getAgencyWorkspaceOrThrow();

    const parsed = createTasksFromAiSchema.safeParse({ projectId, tasks });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid tasks" };
    const input = parsed.data;
    const today = startOfUtcDay();

    const result = await prisma.$transaction(async (tx) => {
      const project = await findOwnedProject(tx, workspace, input.projectId);

      for (const draft of input.tasks) {
        const task = await tx.task.create({
          data: {
            title: draft.title,
            description: draft.description,
            priority: draft.priority,
            status: "TODO",
            dueDate:
              draft.suggestedDueDateDays === null ? null : new Date(today.getTime() + draft.suggestedDueDateDays * DAY_MS),
            projectId: project.id,
          },
          select: { id: true, title: true },
        });
        await logActivity(tx, workspace, {
          action: ActivityAction.TASK_CREATED,
          entityType: "Task",
          entityId: task.id,
          projectId: project.id,
          metadata: { label: task.title, projectId: project.id, projectName: project.name, source: "ai_meeting_notes" },
        });
      }

      const statuses = await tx.task.findMany({ where: { projectId: project.id }, select: { status: true } });
      return { projectId: project.id, progress: deriveProgress(statuses) };
    });

    revalidateAgency(result.projectId);
    const count = input.tasks.length;
    return {
      ok: true,
      message: `${count} task${count === 1 ? "" : "s"} added to the project`,
      data: { count, progress: result.progress },
    };
  } catch (error) {
    return toFailure(error, "Could not add tasks");
  }
}
