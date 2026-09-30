import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, Flag, FolderOpen, Inbox, MessageSquareReply, Video, type LucideIcon } from "lucide-react";
import { requireClientContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deriveProgress } from "@/lib/progress";
import { formatDate, formatShortDate, startOfUtcDay } from "@/lib/dates";
import { getClientTimeline } from "@/lib/client-timeline";
import { ProgressMeter, ProjectStatusBadge } from "@/components/agency/badges";
import { ClientTimeline } from "@/components/client/client-timeline";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

const UPCOMING_MEETING_DAYS = 14;
const STATUS_ORDER: Record<string, number> = { ACTIVE: 0, PLANNING: 1, ON_HOLD: 2, COMPLETED: 3 };

export default async function ClientDashboardPage() {
  const context = await requireClientContext();
  const now = new Date();
  const today = startOfUtcDay(now);

  // Every query is double-scoped: this client's record AND its agency.
  const projectScope = { clientId: context.clientId, agencyId: context.agencyId, status: { not: "ARCHIVED" as const } };

  const [projects, openFeedback, upcomingMeetings, timeline] = await Promise.all([
    prisma.project.findMany({
      where: projectScope,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        endDate: true,
        tasks: { select: { status: true } },
        milestones: {
          where: { status: { not: "COMPLETED" } },
          select: { id: true, title: true, dueDate: true },
        },
      },
    }),
    prisma.feedback.findMany({
      where: { project: projectScope, status: { notIn: ["RESOLVED", "DECLINED"] } },
      select: {
        id: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { author: { select: { role: true } } } },
      },
    }),
    prisma.meeting.count({
      where: {
        project: projectScope,
        isSharedWithClient: true,
        scheduledAt: { gte: now, lt: new Date(now.getTime() + UPCOMING_MEETING_DAYS * 86_400_000) },
      },
    }),
    getClientTimeline(context, { take: 8 }),
  ]);

  // "Needs your attention": the agency posted the latest message on an open request.
  const awaitingClient = openFeedback.filter((item) => {
    const lastAuthorRole = item.messages[0]?.author?.role;
    return lastAuthorRole !== undefined && lastAuthorRole !== "CLIENT";
  }).length;

  const sorted = [...projects].sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
  const firstName = context.user.name.split(" ")[0];

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back, {firstName}</h1>
        <p className="mt-1 text-stone-500">Here&apos;s where things stand with {context.agencyName}.</p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <QuickStat
            label="Replies to review"
            value={awaitingClient}
            hint={awaitingClient > 0 ? "The team is waiting on you" : "You're all caught up"}
            Icon={MessageSquareReply}
            href="/client/feedback"
            highlight={awaitingClient > 0}
          />
          <QuickStat label="Open requests" value={openFeedback.length} hint="Being handled by the team" Icon={Inbox} href="/client/feedback" />
          <QuickStat
            label="Upcoming meetings"
            value={upcomingMeetings}
            hint={`Next ${UPCOMING_MEETING_DAYS} days`}
            Icon={Video}
            href={sorted[0] ? `/client/projects/${sorted[0].id}` : "/client"}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2" aria-labelledby="projects-heading">
          <h2 id="projects-heading" className="mb-4 text-lg font-semibold">
            Your projects
          </h2>
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
              <FolderOpen className="mb-3 h-6 w-6 text-stone-400" aria-hidden />
              <p className="text-sm text-stone-500">No projects have been shared with you yet.</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {sorted.map((project) => {
                const done = project.tasks.filter((task) => task.status === "DONE").length;
                const nextMilestones = [...project.milestones]
                  .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity))
                  .slice(0, 2);
                const late = project.endDate !== null && project.endDate < today && project.status !== "COMPLETED";

                return (
                  <li key={project.id}>
                    <Link
                      href={`/client/projects/${project.id}`}
                      className="group block rounded-2xl border border-stone-200 bg-white p-6 transition hover:border-teal-300 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none"
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold group-hover:text-teal-700">{project.name}</h3>
                          <p className={`mt-1 flex items-center gap-1.5 text-xs ${late ? "text-rose-600" : "text-stone-500"}`}>
                            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                            {project.endDate ? `Target ${formatDate(project.endDate)}` : "No target date"}
                          </p>
                        </div>
                        <ProjectStatusBadge status={project.status} />
                      </div>

                      <ProgressMeter value={deriveProgress(project.tasks)} done={done} total={project.tasks.length} tone="teal" />

                      {nextMilestones.length > 0 && (
                        <div className="mt-5 border-t border-stone-100 pt-4">
                          <p className="mb-2 text-xs font-medium tracking-wider text-stone-500 uppercase">Next milestones</p>
                          <ul className="space-y-1.5">
                            {nextMilestones.map((milestone) => (
                              <li key={milestone.id} className="flex items-center justify-between gap-3 text-sm">
                                <span className="flex min-w-0 items-center gap-2">
                                  <Flag className="h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden />
                                  <span className="truncate">{milestone.title}</span>
                                </span>
                                <span className="shrink-0 text-xs text-stone-500">
                                  {milestone.dueDate ? formatShortDate(milestone.dueDate) : "TBC"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-teal-700">
                        View project <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="updates-heading">
          <h2 id="updates-heading" className="mb-4 text-lg font-semibold">
            Recent updates
          </h2>
          <div className="rounded-2xl border border-stone-200 bg-white p-6">
            <ClientTimeline events={timeline} now={now} />
          </div>
        </section>
      </div>
    </div>
  );
}

function QuickStat({
  label,
  value,
  hint,
  Icon,
  href,
  highlight = false,
}: {
  label: string;
  value: number;
  hint: string;
  Icon: LucideIcon;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-2xl border p-5 transition hover:shadow-sm ${
        highlight ? "border-teal-300 bg-teal-50" : "border-stone-200 bg-white hover:border-stone-300"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-stone-600">{label}</p>
        <Icon className={`h-5 w-5 ${highlight ? "text-teal-600" : "text-stone-400"}`} aria-hidden />
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      <p className={`mt-1 text-xs ${highlight ? "font-medium text-teal-700" : "text-stone-500"}`}>{hint}</p>
    </Link>
  );
}
