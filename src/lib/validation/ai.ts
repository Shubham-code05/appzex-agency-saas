import { z } from "zod";
import { TASK_PRIORITIES } from "@/lib/agency-enums";
import { idSchema } from "./agency";

// ─── Request bodies ─────────────────────────────────────────────────────────

export const meetingSummaryRequestSchema = z.object({
  projectId: idSchema,
  notes: z
    .string({ error: "Paste the meeting notes" })
    .trim()
    .min(20, "Notes are too short to extract tasks from (min 20 characters)")
    .max(20_000, "Notes are too long (max 20,000 characters)"),
});

export const projectHealthRequestSchema = z.object({ projectId: idSchema });

// ─── Task drafts (reviewed by a human, then submitted to createTasksFromAi) ─

export const aiTaskDraftSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  description: z
    .string()
    .trim()
    .max(5000)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null)),
  priority: z.enum(TASK_PRIORITIES),
  suggestedDueDateDays: z.number().int().min(0).max(365).nullable(),
});

export const createTasksFromAiSchema = z.object({
  projectId: idSchema,
  tasks: z.array(aiTaskDraftSchema).min(1, "Select at least one task").max(20, "Add at most 20 tasks at once"),
});

// ─── LLM output (untrusted: coerced, clamped, truncated) ────────────────────

const clampedText = (max: number) =>
  z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .transform((value) => (value.length > max ? `${value.slice(0, max - 1)}…` : value));

export const llmTaskListSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: clampedText(200).pipe(z.string().min(1)),
        description: clampedText(1000).nullable().optional().catch(null),
        priority: z
          .string()
          .transform((value) => value.toUpperCase())
          .pipe(z.enum(TASK_PRIORITIES))
          .catch("MEDIUM"),
        suggestedDueDateDays: z.coerce
          .number()
          .int()
          .min(0)
          .max(365)
          .nullable()
          .catch(null),
      }),
    )
    .max(30)
    .transform((tasks) => tasks.slice(0, 15)),
});

export const llmHealthReportSchema = z.object({
  status: z
    .string()
    .transform((value) => value.toUpperCase())
    .pipe(z.enum(["GREEN", "AMBER", "RED"])),
  headline: clampedText(300).pipe(z.string().min(1)),
  bottlenecks: z.array(clampedText(300)).max(12).transform((items) => items.filter(Boolean).slice(0, 6)),
  nextSteps: z.array(clampedText(300)).max(12).transform((items) => items.filter(Boolean).slice(0, 6)),
});
