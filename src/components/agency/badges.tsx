import { AlarmClock, CalendarClock, ChevronsUp, Equal, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { DueState } from "@/lib/dates";

const PILL = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset";

// ─── Project status ─────────────────────────────────────────────────────────

const PROJECT_STATUS: Record<string, { label: string; className: string }> = {
  PLANNING: { label: "Planning", className: "bg-violet-50 text-violet-700 ring-violet-600/20" },
  ACTIVE: { label: "Active", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  ON_HOLD: { label: "On hold", className: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  COMPLETED: { label: "Completed", className: "bg-sky-50 text-sky-700 ring-sky-600/20" },
  ARCHIVED: { label: "Archived", className: "bg-slate-100 text-slate-600 ring-slate-500/20" },
};

export const PROJECT_STATUS_LABEL = Object.fromEntries(
  Object.entries(PROJECT_STATUS).map(([key, { label }]) => [key, label]),
) as Record<string, string>;

export function ProjectStatusBadge({ status }: { status: string }) {
  const meta = PROJECT_STATUS[status] ?? PROJECT_STATUS.ARCHIVED;
  return <span className={`${PILL} ${meta.className}`}>{meta.label}</span>;
}

// ─── Task priority ──────────────────────────────────────────────────────────

const PRIORITY: Record<string, { label: string; className: string; Icon: typeof Equal }> = {
  LOW: { label: "Low", className: "bg-slate-50 text-slate-600 ring-slate-500/20", Icon: ChevronDown },
  MEDIUM: { label: "Medium", className: "bg-sky-50 text-sky-700 ring-sky-600/20", Icon: Equal },
  HIGH: { label: "High", className: "bg-orange-50 text-orange-700 ring-orange-600/20", Icon: ChevronsUp },
  URGENT: { label: "Urgent", className: "bg-rose-50 text-rose-700 ring-rose-600/20", Icon: ChevronsUpDown },
};

export function PriorityBadge({ priority }: { priority: string }) {
  const meta = PRIORITY[priority] ?? PRIORITY.MEDIUM;
  return (
    <span className={`${PILL} ${meta.className}`}>
      <meta.Icon className="h-3 w-3" aria-hidden />
      {meta.label}
    </span>
  );
}

// ─── Due state ──────────────────────────────────────────────────────────────

export function DueBadge({ state }: { state: DueState }) {
  if (state === "overdue") {
    return (
      <span className={`${PILL} bg-rose-50 text-rose-700 ring-rose-600/20`}>
        <AlarmClock className="h-3 w-3" aria-hidden />
        Overdue
      </span>
    );
  }
  if (state === "due_this_week") {
    return (
      <span className={`${PILL} bg-amber-50 text-amber-800 ring-amber-600/20`}>
        <CalendarClock className="h-3 w-3" aria-hidden />
        Due this week
      </span>
    );
  }
  return null;
}

// ─── Progress ───────────────────────────────────────────────────────────────

export function ProgressMeter({
  value,
  done,
  total,
  size = "md",
  tone = "indigo",
}: {
  value: number;
  done?: number;
  total?: number;
  size?: "sm" | "md";
  /** indigo = agency workspace, teal = client portal. */
  tone?: "indigo" | "teal";
}) {
  const color = value === 100 ? "bg-emerald-500" : tone === "teal" ? "bg-teal-500" : "bg-indigo-500";
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="text-slate-500">
          {total === undefined ? "Progress" : total === 0 ? "No tasks yet" : `${done} of ${total} tasks done`}
        </span>
        <span className="font-semibold text-slate-900 tabular-nums">{value}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Project progress"
        className={`overflow-hidden rounded-full bg-slate-100 ${size === "sm" ? "h-1.5" : "h-2.5"}`}
      >
        <div className={`h-full rounded-full transition-[width] duration-500 ease-out ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700 ${
        size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs"
      }`}
    >
      {initials(name)}
    </span>
  );
}
