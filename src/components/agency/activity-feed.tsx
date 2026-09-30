import Link from "next/link";
import {
  Briefcase,
  CalendarPlus,
  CheckCircle2,
  Eye,
  FileUp,
  FolderPlus,
  ListPlus,
  MessageSquare,
  MessageSquarePlus,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { ActivityAction } from "@/lib/activity";
import { formatRelative } from "@/lib/dates";
import { FEEDBACK_STATUS_META, normalizeFeedbackStatus } from "@/lib/feedback";

export interface ActivityEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: Date;
  projectId: string | null;
  user: { name: string; role: string } | null;
}

const STATUS_LABEL: Record<string, string> = { TODO: "To do", IN_PROGRESS: "In progress", DONE: "Done" };

function meta(entry: ActivityEntry): Record<string, unknown> {
  return entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata)
    ? (entry.metadata as Record<string, unknown>)
    : {};
}

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function describe(entry: ActivityEntry): { Icon: LucideIcon; tone: string; text: React.ReactNode; href: string | null } {
  const m = meta(entry);
  const label = str(m.label) ?? str(m.name) ?? str(m.title) ?? "an item";
  const projectId = entry.projectId ?? str(m.projectId);
  const feedbackHref = entry.entityId ? `/agency/feedback/${entry.entityId}` : "/agency/feedback";
  const projectHref = projectId ? `/agency/projects/${projectId}` : null;
  const strong = (text: string) => <strong className="font-medium text-slate-900">{text}</strong>;

  switch (entry.action) {
    case ActivityAction.CLIENT_CREATED:
      return { Icon: Briefcase, tone: "bg-violet-50 text-violet-600", text: <>added client {strong(label)}</>, href: "/agency/clients" };
    case ActivityAction.PROJECT_CREATED:
      return {
        Icon: FolderPlus,
        tone: "bg-indigo-50 text-indigo-600",
        text: <>created project {strong(label)}</>,
        href: entry.entityId ? `/agency/projects/${entry.entityId}` : null,
      };
    case ActivityAction.TASK_CREATED:
      return { Icon: ListPlus, tone: "bg-sky-50 text-sky-600", text: <>added task {strong(label)}</>, href: projectHref };
    case ActivityAction.TASK_COMPLETED:
      return { Icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600", text: <>completed {strong(label)}</>, href: projectHref };
    case ActivityAction.TASK_STATUS_CHANGED: {
      const to = str(m.to);
      if (to === "DONE") {
        return { Icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600", text: <>completed {strong(label)}</>, href: projectHref };
      }
      return {
        Icon: RefreshCw,
        tone: "bg-slate-100 text-slate-600",
        text: (
          <>
            moved {strong(label)} to {STATUS_LABEL[to ?? ""] ?? "a new status"}
          </>
        ),
        href: projectHref,
      };
    }
    case ActivityAction.MEETING_CREATED:
      return { Icon: CalendarPlus, tone: "bg-amber-50 text-amber-600", text: <>scheduled {strong(label)}</>, href: projectHref };
    case ActivityAction.MEETING_SHARING_CHANGED:
      return {
        Icon: Eye,
        tone: "bg-teal-50 text-teal-600",
        text: (
          <>
            {m.isSharedWithClient ? "shared" : "unshared"} {strong(label)} {m.isSharedWithClient ? "with" : "from"} the client
          </>
        ),
        href: projectHref,
      };
    case ActivityAction.FEEDBACK_SUBMITTED:
      return { Icon: MessageSquarePlus, tone: "bg-rose-50 text-rose-600", text: <>submitted request {strong(label)}</>, href: feedbackHref };
    case ActivityAction.FEEDBACK_REPLIED:
      return { Icon: MessageSquare, tone: "bg-violet-50 text-violet-600", text: <>replied on {strong(label)}</>, href: feedbackHref };
    case ActivityAction.FEEDBACK_STATUS_CHANGED: {
      const to = str(m.to);
      return {
        Icon: RefreshCw,
        tone: "bg-violet-50 text-violet-600",
        text: (
          <>
            moved {strong(label)} to {to ? FEEDBACK_STATUS_META[normalizeFeedbackStatus(to)].label : "a new status"}
          </>
        ),
        href: feedbackHref,
      };
    }
    case ActivityAction.FILE_UPLOADED:
      return {
        Icon: FileUp,
        tone: "bg-sky-50 text-sky-600",
        text: (
          <>
            uploaded {strong(label)}
            {m.isSharedWithClient ? " (shared with client)" : ""}
          </>
        ),
        href: projectHref ? `${projectHref}?tab=files` : null,
      };
    case ActivityAction.FILE_SHARING_CHANGED:
      return {
        Icon: Eye,
        tone: "bg-teal-50 text-teal-600",
        text: (
          <>
            {m.isSharedWithClient ? "shared" : "unshared"} {strong(label)} {m.isSharedWithClient ? "with" : "from"} the client
          </>
        ),
        href: projectHref ? `${projectHref}?tab=files` : null,
      };
    default:
      return { Icon: RefreshCw, tone: "bg-slate-100 text-slate-600", text: <>updated {strong(label)}</>, href: null };
  }
}

export function ActivityFeed({ entries, now }: { entries: ActivityEntry[]; now: Date }) {
  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">No activity yet. Create a project to get started.</p>;
  }

  return (
    <ul className="divide-y divide-slate-100">
      {entries.map((entry) => {
        const { Icon, tone, text, href } = describe(entry);
        const viaSupport = meta(entry).viaSupportMode === true;
        const actor = entry.user ? entry.user.name : "Someone";
        const body = (
          <>
            <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone}`}>
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-600">
                <span className="font-medium text-slate-900">{actor}</span>
                {viaSupport && (
                  <span className="ml-1 rounded bg-amber-100 px-1 py-px text-[10px] font-semibold tracking-wide text-amber-800 uppercase">
                    Support
                  </span>
                )}{" "}
                {text}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                <time dateTime={entry.createdAt.toISOString()}>{formatRelative(entry.createdAt, now)}</time>
              </p>
            </div>
          </>
        );
        return (
          <li key={entry.id}>
            {href ? (
              <Link href={href} className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-3 transition hover:bg-slate-50">
                {body}
              </Link>
            ) : (
              <div className="flex items-start gap-3 py-3">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
