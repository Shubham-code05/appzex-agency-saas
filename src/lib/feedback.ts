/**
 * Feedback / change-request workflow rules. Dependency-free: used by server
 * actions (enforcement) and client components (which options to offer).
 *
 *   OPEN → IN_REVIEW → IN_PROGRESS → RESOLVED | DECLINED
 *
 * Shortcuts forward are allowed, and closed items can be reopened.
 */

export const FEEDBACK_STATUSES = ["OPEN", "IN_REVIEW", "IN_PROGRESS", "RESOLVED", "DECLINED"] as const;
export type FeedbackStatusValue = (typeof FEEDBACK_STATUSES)[number];

/** Maps legacy values (pre-Phase 4 `ACKNOWLEDGED`) onto the current workflow. */
export function normalizeFeedbackStatus(status: string): FeedbackStatusValue {
  if (status === "ACKNOWLEDGED") return "IN_REVIEW";
  return (FEEDBACK_STATUSES as readonly string[]).includes(status) ? (status as FeedbackStatusValue) : "OPEN";
}

export const FEEDBACK_TRANSITIONS: Record<FeedbackStatusValue, readonly FeedbackStatusValue[]> = {
  OPEN: ["IN_REVIEW", "IN_PROGRESS", "RESOLVED", "DECLINED"],
  IN_REVIEW: ["IN_PROGRESS", "RESOLVED", "DECLINED"],
  IN_PROGRESS: ["IN_REVIEW", "RESOLVED", "DECLINED"],
  RESOLVED: ["IN_PROGRESS"], // reopen
  DECLINED: ["IN_REVIEW"], // reconsider
};

export function canTransition(from: string, to: FeedbackStatusValue): boolean {
  return FEEDBACK_TRANSITIONS[normalizeFeedbackStatus(from)].includes(to);
}

export function isClosedStatus(status: string): boolean {
  const normalized = normalizeFeedbackStatus(status);
  return normalized === "RESOLVED" || normalized === "DECLINED";
}

export const FEEDBACK_STATUS_META: Record<FeedbackStatusValue, { label: string; className: string; dot: string }> = {
  OPEN: { label: "Open", className: "bg-amber-50 text-amber-800 ring-amber-600/20", dot: "bg-amber-500" },
  IN_REVIEW: { label: "In review", className: "bg-violet-50 text-violet-700 ring-violet-600/20", dot: "bg-violet-500" },
  IN_PROGRESS: { label: "In progress", className: "bg-sky-50 text-sky-700 ring-sky-600/20", dot: "bg-sky-500" },
  RESOLVED: { label: "Resolved", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", dot: "bg-emerald-500" },
  DECLINED: { label: "Declined", className: "bg-slate-100 text-slate-600 ring-slate-500/20", dot: "bg-slate-400" },
};

export function feedbackTitle(feedback: { title: string; content: string }): string {
  if (feedback.title.trim()) return feedback.title;
  const firstLine = feedback.content.split("\n")[0]?.trim() ?? "";
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine || "Untitled request";
}
