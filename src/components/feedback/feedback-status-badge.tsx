import { FEEDBACK_STATUS_META, normalizeFeedbackStatus } from "@/lib/feedback";

export function FeedbackStatusBadge({ status }: { status: string }) {
  const meta = FEEDBACK_STATUS_META[normalizeFeedbackStatus(status)];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${meta.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
      {meta.label}
    </span>
  );
}
