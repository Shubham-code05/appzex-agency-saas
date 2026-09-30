import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Inbox, MessageCircle, Paperclip } from "lucide-react";
import { requireClientContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRelative } from "@/lib/dates";
import { feedbackTitle, isClosedStatus } from "@/lib/feedback";
import { FeedbackStatusBadge } from "@/components/feedback/feedback-status-badge";
import { FeedbackForm } from "./_components/feedback-form";

export const metadata: Metadata = { title: "Requests" };
export const dynamic = "force-dynamic";

export default async function ClientFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string | string[] }>;
}) {
  const context = await requireClientContext();
  const { project: requestedProject } = await searchParams;
  const now = new Date();

  const projectScope = { clientId: context.clientId, agencyId: context.agencyId, status: { not: "ARCHIVED" as const } };

  const [projects, requests] = await Promise.all([
    prisma.project.findMany({ where: projectScope, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.feedback.findMany({
      where: { project: { clientId: context.clientId, agencyId: context.agencyId } },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        content: true,
        status: true,
        updatedAt: true,
        project: { select: { name: true } },
        _count: { select: { messages: true, files: { where: { isSharedWithClient: true } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { author: { select: { role: true } } } },
      },
    }),
  ]);

  // Only preselect a project the client actually owns.
  const defaultProjectId =
    typeof requestedProject === "string" && projects.some((project) => project.id === requestedProject)
      ? requestedProject
      : undefined;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
      <section id="new-request" aria-labelledby="new-request-heading" className="lg:col-span-2">
        <h1 id="new-request-heading" className="text-2xl font-semibold tracking-tight">
          Request a change
        </h1>
        <p className="mt-1 mb-6 text-sm text-stone-500">
          Share feedback or ask for changes. {context.agencyName} will reply here.
        </p>
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          {projects.length === 0 ? (
            <p className="text-sm text-stone-500">You&apos;ll be able to send requests once a project is shared with you.</p>
          ) : (
            <FeedbackForm projects={projects} defaultProjectId={defaultProjectId} />
          )}
        </div>
      </section>

      <section aria-labelledby="requests-heading" className="lg:col-span-3">
        <h2 id="requests-heading" className="mb-4 text-lg font-semibold">
          Your requests
        </h2>
        {requests.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
            <Inbox className="mb-3 h-6 w-6 text-stone-400" aria-hidden />
            <p className="text-sm text-stone-500">No requests yet.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {requests.map((item) => {
              const lastRole = item.messages[0]?.author?.role;
              const newReply = !isClosedStatus(item.status) && lastRole !== undefined && lastRole !== "CLIENT";
              return (
                <li key={item.id}>
                  <Link
                    href={`/client/feedback/${item.id}`}
                    className={`group flex items-center gap-4 rounded-2xl border bg-white p-5 transition hover:shadow-sm ${
                      newReply ? "border-teal-300" : "border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <FeedbackStatusBadge status={item.status} />
                        {newReply && (
                          <span className="rounded-full bg-teal-600 px-2 py-0.5 text-xs font-medium text-white">New reply</span>
                        )}
                      </div>
                      <p className="truncate font-medium group-hover:text-teal-700">{feedbackTitle(item)}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                        <span>{item.project.name}</span>
                        <span>Updated {formatRelative(item.updatedAt, now)}</span>
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
                    <ChevronRight className="h-5 w-5 shrink-0 text-stone-300 group-hover:text-teal-600" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
