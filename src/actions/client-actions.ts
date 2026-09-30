"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActivityAction, type ActivityActionName } from "@/lib/activity";
import type { ActionResult } from "@/lib/action-result";
import { AuthError, getClientContextOrThrow, type ClientContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { discardUpload, getOptionalFile, storeUpload, UploadError, type StoredUpload } from "@/lib/uploads";
import { formDataToObject, toFieldErrors } from "@/lib/validation/agency";
import { feedbackReplySchema, submitFeedbackSchema } from "@/lib/validation/portal";

/*
 * Client-isolation contract for every action in this file:
 *
 *  1. The caller must be a CLIENT; clientId and agencyId come ONLY from the
 *     verified session (getClientContextOrThrow), never from the payload.
 *  2. Every referenced project/feedback is looked up with BOTH
 *     `clientId` and `agencyId` in the WHERE clause. Another client's id is
 *     indistinguishable from a missing one ("not found").
 *  3. Files a client uploads are attached to their own feedback and are
 *     always shared (the client authored them).
 */

type Tx = Prisma.TransactionClient;

class NotFoundError extends Error {}

function toFailure(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof AuthError || error instanceof NotFoundError || error instanceof UploadError) {
    return { ok: false, error: error.message };
  }
  console.error(`[client action] ${fallback}:`, error);
  return { ok: false, error: `${fallback}. Please try again.` };
}

function validationFailure(error: z.ZodError) {
  return { ok: false as const, error: "Please fix the highlighted fields.", fieldErrors: toFieldErrors(error) };
}

async function logClientActivity(
  tx: Tx,
  context: ClientContext,
  entry: { action: ActivityActionName; entityId: string; projectId: string; metadata: Record<string, unknown> },
): Promise<void> {
  await tx.activityLog.create({
    data: {
      action: entry.action,
      entityType: "Feedback",
      entityId: entry.entityId,
      projectId: entry.projectId,
      isClientView: true,
      agencyId: context.agencyId,
      userId: context.user.id,
      metadata: { ...entry.metadata, byClient: true } as Prisma.InputJsonObject,
    },
  });
}

async function storeAttachment(formData: FormData, context: ClientContext, projectId: string): Promise<StoredUpload | null> {
  const file = getOptionalFile(formData, "attachment");
  if (!file) return null;
  return storeUpload(file, { agencyId: context.agencyId, projectId });
}

function revalidateFeedback(feedbackId?: string): void {
  revalidatePath("/client", "layout");
  revalidatePath("/agency", "layout");
  if (feedbackId) {
    revalidatePath(`/client/feedback/${feedbackId}`);
    revalidatePath(`/agency/feedback/${feedbackId}`);
  }
}

// ─── submitClientFeedback ───────────────────────────────────────────────────

export async function submitClientFeedback(formData: FormData): Promise<ActionResult<{ id: string }>> {
  let stored: StoredUpload | null = null;
  try {
    const context = await getClientContextOrThrow();

    const parsed = submitFeedbackSchema.safeParse(formDataToObject(formData, ["projectId", "title", "description"]));
    if (!parsed.success) return validationFailure(parsed.error);
    const input = parsed.data;

    // Ownership check before anything is written (DB or storage).
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, clientId: context.clientId, agencyId: context.agencyId, status: { not: "ARCHIVED" } },
      select: { id: true, name: true },
    });
    if (!project) {
      return { ok: false, error: "Project not found", fieldErrors: { projectId: ["Select one of your projects"] } };
    }

    try {
      stored = await storeAttachment(formData, context, project.id);
    } catch (error) {
      if (error instanceof UploadError) return { ok: false, error: error.message, fieldErrors: { attachment: [error.message] } };
      throw error;
    }
    const upload = stored;

    const feedback = await prisma.$transaction(async (tx) => {
      const created = await tx.feedback.create({
        data: {
          title: input.title,
          content: input.description,
          status: "OPEN",
          projectId: project.id,
          authorId: context.user.id,
        },
        select: { id: true, title: true },
      });
      if (upload) {
        await tx.fileRecord.create({
          data: {
            ...upload,
            isSharedWithClient: true,
            projectId: project.id,
            feedbackId: created.id,
            uploadedById: context.user.id,
          },
        });
      }
      await logClientActivity(tx, context, {
        action: ActivityAction.FEEDBACK_SUBMITTED,
        entityId: created.id,
        projectId: project.id,
        metadata: { label: created.title, projectName: project.name },
      });
      return created;
    });
    stored = null;

    revalidateFeedback(feedback.id);
    return { ok: true, message: "Your request was sent to the team", data: { id: feedback.id } };
  } catch (error) {
    await discardUpload(stored);
    return toFailure(error, "Could not submit your request");
  }
}

// ─── replyToFeedback ────────────────────────────────────────────────────────

/** Client follow-up on their own change request (optionally with an attachment). */
export async function replyToFeedback(formData: FormData): Promise<ActionResult> {
  let stored: StoredUpload | null = null;
  try {
    const context = await getClientContextOrThrow();

    const parsed = feedbackReplySchema.safeParse(formDataToObject(formData, ["feedbackId", "body"]));
    if (!parsed.success) return validationFailure(parsed.error);
    const input = parsed.data;

    const feedback = await prisma.feedback.findFirst({
      where: { id: input.feedbackId, project: { clientId: context.clientId, agencyId: context.agencyId } },
      select: { id: true, title: true, content: true, projectId: true },
    });
    if (!feedback) throw new NotFoundError("Request not found");

    try {
      stored = await storeAttachment(formData, context, feedback.projectId);
    } catch (error) {
      if (error instanceof UploadError) return { ok: false, error: error.message, fieldErrors: { attachment: [error.message] } };
      throw error;
    }
    const upload = stored;

    await prisma.$transaction(async (tx) => {
      await tx.feedbackMessage.create({
        data: { feedbackId: feedback.id, authorId: context.user.id, body: input.body },
      });
      if (upload) {
        await tx.fileRecord.create({
          data: {
            ...upload,
            isSharedWithClient: true,
            projectId: feedback.projectId,
            feedbackId: feedback.id,
            uploadedById: context.user.id,
          },
        });
      }
      await tx.feedback.update({ where: { id: feedback.id }, data: { updatedAt: new Date() } });
      await logClientActivity(tx, context, {
        action: ActivityAction.FEEDBACK_REPLIED,
        entityId: feedback.id,
        projectId: feedback.projectId,
        metadata: { label: feedback.title || feedback.content.slice(0, 80) },
      });
    });
    stored = null;

    revalidateFeedback(feedback.id);
    return { ok: true, message: "Reply sent" };
  } catch (error) {
    await discardUpload(stored);
    return toFailure(error, "Could not send your reply");
  }
}
