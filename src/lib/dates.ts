/**
 * Date conventions (shared by server and client code):
 * - A task/project due date is a *calendar day*, stored as 00:00 UTC of that day.
 * - Meeting times are entered and displayed in UTC.
 * - "Overdue"        = not DONE and due before today (UTC).
 * - "Due this week"  = not DONE and due today or within the next 6 days (UTC).
 */

const DAY_MS = 86_400_000;
export const DUE_SOON_DAYS = 7;

export function startOfUtcDay(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function dueWindow(now: Date = new Date()): { today: Date; weekEnd: Date } {
  const today = startOfUtcDay(now);
  return { today, weekEnd: new Date(today.getTime() + DUE_SOON_DAYS * DAY_MS) };
}

export type DueState = "overdue" | "due_this_week" | null;

export function getDueState(
  dueDate: Date | string | null | undefined,
  status: string,
  now: Date | string = new Date(),
): DueState {
  if (!dueDate || status === "DONE") return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  const { today, weekEnd } = dueWindow(new Date(now));
  if (due < today) return "overdue";
  if (due < weekEnd) return "due_this_week";
  return null;
}

const DATE_INPUT = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Parses an `<input type="date">` value (YYYY-MM-DD) to 00:00 UTC, rejecting impossible dates. */
export function parseDateInput(value: string): Date | null {
  const match = DATE_INPUT.exec(value);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (y < 2000 || y > 2100) return null;
  return date;
}

/** Parses an `<input type="datetime-local">` value (YYYY-MM-DDTHH:mm) as UTC. */
export function parseDateTimeInput(value: string): Date | null {
  const match = DATETIME_INPUT.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  if (h > 23 || mi > 59 || y < 2000 || y > 2100) return null;
  return date;
}

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const shortDateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

export function formatDate(value: Date | string): string {
  return dateFormat.format(new Date(value));
}

export function formatShortDate(value: Date | string): string {
  return shortDateFormat.format(new Date(value));
}

export function formatDateTime(value: Date | string): string {
  return `${dateTimeFormat.format(new Date(value))} UTC`;
}

export function formatRelative(value: Date | string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(value).getTime() - now.getTime()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}
