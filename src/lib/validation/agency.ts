import { z } from "zod";
import type { FieldErrors } from "@/lib/action-result";
import { PROJECT_STATUSES, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/agency-enums";
import { parseDateInput, parseDateTimeInput } from "@/lib/dates";

// ─── Primitives ─────────────────────────────────────────────────────────────

export const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/, "Invalid id");

const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .optional()
    .transform((value) => (value ? value : null));

const optionalId = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))
  .pipe(idSchema.nullable());

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const date = parseDateInput(value);
    if (!date) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date" });
      return z.NEVER;
    }
    return date;
  });

const requiredDateTime = z
  .string({ error: "Date and time are required" })
  .trim()
  .min(1, "Date and time are required")
  .transform((value, ctx) => {
    const date = parseDateTimeInput(value);
    if (!date) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date and time" });
      return z.NEVER;
    }
    return date;
  });

const checkbox = z
  .string()
  .optional()
  .transform((value) => value === "on" || value === "true");

// ─── Enums ──────────────────────────────────────────────────────────────────

export const taskStatusSchema = z.enum(TASK_STATUSES, { error: "Invalid task status" });

// ─── Forms ──────────────────────────────────────────────────────────────────

export const createClientSchema = z.object({
  name: requiredText("Client name", 120),
  companyName: requiredText("Company name", 160),
  contactEmail: z
    .string({ error: "Contact email is required" })
    .trim()
    .toLowerCase()
    .max(254, "Email is too long")
    .pipe(z.email("Enter a valid email address")),
});

export const createProjectSchema = z
  .object({
    name: requiredText("Project name", 160),
    description: optionalText("Description", 5000),
    clientId: z.string({ error: "Select a client" }).trim().min(1, "Select a client").pipe(idSchema),
    status: z.enum(PROJECT_STATUSES, { error: "Invalid status" }).default("ACTIVE"),
    startDate: optionalDate,
    dueDate: optionalDate,
  })
  .refine((data) => !data.startDate || !data.dueDate || data.dueDate >= data.startDate, {
    path: ["dueDate"],
    message: "Due date cannot be before the start date",
  });

export const createTaskSchema = z.object({
  projectId: idSchema,
  title: requiredText("Title", 200),
  description: optionalText("Description", 5000),
  priority: z.enum(TASK_PRIORITIES, { error: "Invalid priority" }).default("MEDIUM"),
  status: taskStatusSchema.default("TODO"),
  dueDate: optionalDate,
  assigneeId: optionalId,
});

export const createMeetingSchema = z.object({
  projectId: idSchema,
  title: requiredText("Title", 200),
  scheduledAt: requiredDateTime,
  durationMinutes: z.coerce
    .number({ error: "Duration must be a number" })
    .int("Duration must be whole minutes")
    .min(5, "Minimum 5 minutes")
    .max(480, "Maximum 8 hours")
    .default(30),
  notes: optionalText("Notes", 10_000),
  meetingUrl: z
    .string()
    .trim()
    .max(500, "URL is too long")
    .optional()
    .transform((value) => (value ? value : null))
    .pipe(z.url({ protocol: /^https?$/, error: "Enter a valid http(s) URL" }).nullable()),
  isSharedWithClient: checkbox,
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/** FormData → plain object of strings. Files and empty keys become undefined. */
export function formDataToObject(formData: FormData, keys: readonly string[]): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const key of keys) {
    const value = formData.get(key);
    result[key] = typeof value === "string" ? value : undefined;
  }
  return result;
}

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}
