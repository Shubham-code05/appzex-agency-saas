import { z } from "zod";
import { FEEDBACK_STATUSES } from "@/lib/feedback";
import { idSchema } from "./agency";

const text = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

const optionalId = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))
  .pipe(idSchema.nullable());

// ─── Client portal ──────────────────────────────────────────────────────────

export const submitFeedbackSchema = z.object({
  projectId: z.string({ error: "Select a project" }).trim().min(1, "Select a project").pipe(idSchema),
  title: text("Title", 200),
  description: text("Description", 5000),
});

export const feedbackReplySchema = z.object({
  feedbackId: idSchema,
  body: text("Message", 5000),
});

// ─── Agency side ────────────────────────────────────────────────────────────

export const feedbackStatusSchema = z.enum(FEEDBACK_STATUSES, { error: "Invalid status" });

export const feedbackReviewSchema = z.object({
  feedbackId: idSchema,
  status: feedbackStatusSchema,
  replyText: z
    .string()
    .trim()
    .max(5000, "Reply must be at most 5000 characters")
    .optional()
    .transform((value) => (value ? value : null)),
});

export const uploadFileSchema = z.object({
  projectId: idSchema,
  taskId: optionalId,
  feedbackId: optionalId,
  isSharedWithClient: z
    .string()
    .optional()
    .transform((value) => value === "on" || value === "true"),
});
