import type { Metadata } from "next";
import Link from "next/link";
import { AlarmClock, ArrowRight, Briefcase, CalendarClock, CheckCircle2, FolderKanban, ListChecks, type LucideIcon } from "lucide-react";
import { requireAgencyWorkspace } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AGENCY_FEED_ACTIONS } from "@/lib/activity";
import { dueWindow, formatShortDate, getDueState } from "@/lib/dates";
import { ActivityFeed } from "@/components/agency/activity-feed";
import { Avatar, DueBadge } from "@/components/agency/badges";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const numberFormat = new Intl.NumberFormat("en-US");

export default async function AgencyDashboardPage() {
  const workspace = await requireAgencyWorkspace();
  const { agencyId } = workspace;
  const now = new Date();
  const { today, weekEnd } = dueWindow(now);

  // Tasks have no agencyId column: they are always scoped through their project.
  const taskScope = { project: { agencyId } };
  const openTaskScope = { ...taskScope, status: { not: "DONE" as const } };

  const [
    activeProjects,
    totalProjects,
    totalClients,
    totalTasks,
    completedTasks,
    overdueTasks,
    dueThisWeekTasks,
    attentionTasks,
    activity,
  ] = await Promise.all([
    prisma.project.count({ where: { agencyId, status: "ACTIVE" } }),
    prisma.project.count({ where: { agencyId } }),
    prisma.client.count({ where: { agencyId } }),
    prisma.task.count({ where: taskScope }),
    prisma.task.count({ where: { ...taskScope, status: "DONE" } }),
    prisma.task.count({ where: { ...openTaskScope, dueDate: { lt: today } } }),
    prisma.task.count({ where: { ...openTaskScope, dueDate: { gte: today, lt: weekEnd } } }),
    prisma.task.findMany({
      where: { ...openTaskScope, dueDate: { lt: weekEnd } },
      orderBy: { dueDate: "asc" },
      take: 6,
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        project: { select: { id: true, name: true } },
        assignee: { select: { name: true } },
      },
    }),
    prisma.activityLog.findMany({
      where: { agencyId, action: { in: AGENCY_FEED_ACTIONS } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        projectId: true,
        metadata: true,
        createdAt: true,
        user: { select: { name: true, role: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">What&apos;s happening across {workspace.agencyName}.</p>
      </div>

      <section aria-label="Overview" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active projects"
          value={activeProjects}
          hint={`${numberFormat.format(totalProjects)} total`}
          Icon={FolderKanban}
          href="/agency/projects"
        />
        <StatCard label="Clients" value={totalClients} hint="Client companies" Icon={Briefcase} href="/agency/clients" />

        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Total tasks</p>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <ListChecks className="h-4 w-4" aria-hidden />
            </span>
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {numberFormat.format(totalTasks)}
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-2">
            <TaskStat label="Overdue" value={overdueTasks} Icon={AlarmClock} className="bg-rose-50 text-rose-700" />
            <TaskStat label="Due this week" value={dueThisWeekTasks} Icon={CalendarClock} className="bg-amber-50 text-amber-800" />
            <TaskStat label="Completed" value={completedTasks} Icon={CheckCircle2} className="bg-emerald-50 text-emerald-700" />
          </dl>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-3">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Recent activity</h2>
          <ActivityFeed entries={activity} now={now} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Needs attention</h2>
            <Link href="/agency/projects" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-500">
              Projects <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          {attentionTasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Nothing overdue or due this week.</p>
          ) : (
            <ul className="space-y-2">
              {attentionTasks.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/agency/projects/${task.project.id}`}
                    className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5 transition hover:border-slate-200 hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{task.title}</p>
                      <p className="truncate text-xs text-slate-500">
                        {task.project.name}
                        {task.dueDate && ` · ${formatShortDate(task.dueDate)}`}
                      </p>
                    </div>
                    <DueBadge state={getDueState(task.dueDate, task.status, now)} />
                    {task.assignee && <Avatar name={task.assignee.name} />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  Icon,
  href,
}: {
  label: string;
  value: number;
  hint: string;
  Icon: LucideIcon;
  href: string;
}) {
  return (
    <Link href={href} className="group rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{numberFormat.format(value)}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </Link>
  );
}

function TaskStat({ label, value, Icon, className }: { label: string; value: number; Icon: LucideIcon; className: string }) {
  return (
    <div className={`rounded-lg px-3 py-2 ${className}`}>
      <dt className="flex items-center gap-1 text-xs font-medium">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{numberFormat.format(value)}</dd>
    </div>
  );
}
