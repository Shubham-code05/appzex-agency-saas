import type { Metadata } from "next";
import Link from "next/link";
import type { FeedbackStatus, Prisma } from "@prisma/client";
import { ChevronRight, MessageCircle, MessageSquareText, Paperclip } from "lucide-react";
import { requireAgencyWorkspace } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRelative } from "@/lib/dates";
import { FEEDBACK_STATUSES, FEEDBACK_STATUS_META, feedbackTitle, isClosedStatus, type FeedbackStatusValue } from "@/lib/feedback";
import { FeedbackStatusBadge } from "@/components/feedback/feedback-status-badge";

export const metadata: Metadata = { title: "Feedback" };
export const dynamic = "force-dynamic";

type Filter = "needs_reply" | "active" | FeedbackStatusValue | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "needs_reply", label: "Needs reply" },
  { value: "active", label: "All open" },
  ...FEEDBACK_STATUSES.map((status) => ({ value: status as Filter, label: FEEDBACK_STATUS_META[status].label })),
  { value: "all", label: "Everything" },
];

function statusWhere(filter: Filter): Prisma.FeedbackWhereInput {
  if (filter === "all" || filter === "needs_reply") return {};
  if (filter === "active") return { status: { notIn: ["RESOLVED", "DECLINED"] } };
  // Legacy ACKNOWLEDGED rows belong to the "In review" bucket.
  if (filter === "IN_REVIEW") return { status: { in: ["IN_REVIEW", "ACKNOWLEDGED"] satisfies FeedbackStatus[] } };
  return { status: filter };
}

export default async function AgencyFeedbackPage({ searchParams }: { searchParams: Promise<{ filter?: string | string[] }> }) {
  const { agencyId } = await requireAgencyWorkspace();
  const { filter: rawFilter } = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.value === rawFilter) ? (rawFilter as Filter) : "needs_reply";
  const now = new Date();

  const items = await prisma.feedback.findMany({
    where: { project: { agencyId }, ...statusWhere(filter) },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      content: true,
      status: true,
      updatedAt: true,
      author: { select: { name: true } },
      project: { select: { name: true, client: { select: { companyName: true } } } },
      _count: { select: { messages: true, files: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { author: { select: { role: true } } } },
    },
  });

  // Needs a reply: still open, and the client spoke last (or nobody has replied yet).
  const withFlags = items.map((item) => {
    const lastRole = item.messages[0]?.author?.role;
    const needsReply = !isClosedStatus(item.status) && (lastRole === undefined || lastRole === "CLIENT");
    return { ...item, needsReply };
  });
  const visible = filter === "needs_reply" ? withFlags.filter((item) => item.needsReply) : withFlags;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Feedback & change requests</h1>
        <p className="mt-1 text-sm text-slate-500">Review client requests, update their status and reply.</p>
      </div>

      <nav aria-label="Filter feedback" className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <Link
            key={option.value}
            href={option.value === "needs_reply" ? "/agency/feedback" : `/agency/feedback?filter=${option.value}`}
            aria-current={filter === option.value ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
              filter === option.value
                ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <MessageSquareText className="mb-3 h-6 w-6 text-slate-400" aria-hidden />
          <p className="text-sm text-slate-500">
            {filter === "needs_reply" ? "Nothing waiting on you. Nice work." : "No requests match this filter."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {visible.map((item) => (
            <li key={item.id}>
              <Link href={`/agency/feedback/${item.id}`} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <FeedbackStatusBadge status={item.status} />
                    {item.needsReply && (
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-600/20 ring-inset">
                        Needs reply
                      </span>
                    )}
                  </div>
                  <p className="truncate font-medium text-slate-900 group-hover:text-indigo-700">{feedbackTitle(item)}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>{item.project.client.companyName}</span>
                    <span>{item.project.name}</span>
                    <span>by {item.author.name}</span>
                    <span>{formatRelative(item.updatedAt, now)}</span>
                    {item._count.messages > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" aria-hidden />
                        {item._count.messages}
                      </span>
                    )}
                    {item._count.files > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Paperclip className="h-3 w-3" aria-hidden />
                        {item._count.files}
                      </span>
                    )}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 group-hover:text-indigo-500" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
