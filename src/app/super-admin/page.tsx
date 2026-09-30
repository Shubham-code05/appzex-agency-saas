import type { Metadata } from "next";
import Link from "next/link";
import type { AgencyStatus, Role } from "@prisma/client";
import {
  ArrowRight,
  Briefcase,
  Building2,
  FolderKanban,
  LogIn,
  LogOut as LogOutIcon,
  RefreshCw,
  Users,
  type LucideIcon,
} from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ActivityAction, PLATFORM_AUDIT_ACTIONS } from "@/lib/activity";
import { AGENCY_STATUS_META } from "@/components/agency-status-badge";

export const metadata: Metadata = { title: "Platform dashboard" };
export const dynamic = "force-dynamic";

const STATUS_ORDER: AgencyStatus[] = ["ACTIVE", "INACTIVE", "SUSPENDED"];

const AUDIT_META: Record<string, { label: string; Icon: LucideIcon; tone: string }> = {
  [ActivityAction.AGENCY_STATUS_CHANGED]: { label: "Status changed", Icon: RefreshCw, tone: "bg-sky-50 text-sky-600" },
  [ActivityAction.SUPPORT_MODE_STARTED]: { label: "Entered support mode", Icon: LogIn, tone: "bg-amber-50 text-amber-600" },
  [ActivityAction.SUPPORT_MODE_ENDED]: { label: "Exited support mode", Icon: LogOutIcon, tone: "bg-slate-100 text-slate-600" },
};

const numberFormat = new Intl.NumberFormat("en-US");
const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

function metadataString(metadata: unknown, key: string): string | null {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, unknown>)[key];
    return typeof value === "string" ? value : null;
  }
  return null;
}

export default async function SuperAdminDashboardPage() {
  await requirePageUser(["SUPER_ADMIN"]);

  const [agencyGroups, userGroups, clientCount, projectCount, recentAudit] = await Promise.all([
    prisma.agency.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.client.count(),
    prisma.project.count(),
    prisma.activityLog.findMany({
      where: { action: { in: PLATFORM_AUDIT_ACTIONS } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        action: true,
        metadata: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        agency: { select: { name: true } },
      },
    }),
  ]);

  const agencyByStatus = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<AgencyStatus, number>;
  for (const group of agencyGroups) agencyByStatus[group.status] = group._count._all;
  const totalAgencies = STATUS_ORDER.reduce((sum, s) => sum + agencyByStatus[s], 0);

  const usersByRole: Partial<Record<Role, number>> = {};
  for (const group of userGroups) usersByRole[group.role] = group._count._all;
  const totalUsers = Object.values(usersByRole).reduce((sum, n) => sum + (n ?? 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Platform overview</h1>
        <p className="mt-1 text-sm text-slate-500">Every tenant on Appzex at a glance.</p>
      </div>

      <section aria-label="Key metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total agencies"
          value={totalAgencies}
          Icon={Building2}
          hint={`${numberFormat.format(agencyByStatus.ACTIVE)} active`}
        />
        <MetricCard
          label="Platform users"
          value={totalUsers}
          Icon={Users}
          hint={`${numberFormat.format((usersByRole.AGENCY_ADMIN ?? 0) + (usersByRole.AGENCY_TEAM ?? 0))} agency · ${numberFormat.format(usersByRole.CLIENT ?? 0)} client`}
        />
        <MetricCard label="Client companies" value={clientCount} Icon={Briefcase} hint="Across all agencies" />
        <MetricCard label="Projects" value={projectCount} Icon={FolderKanban} hint="Across all agencies" />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Agency status</h2>
            <Link
              href="/super-admin/agencies"
              className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Manage <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          <div className="mb-5 flex h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            {totalAgencies > 0 &&
              STATUS_ORDER.map((status) =>
                agencyByStatus[status] > 0 ? (
                  <div
                    key={status}
                    className={AGENCY_STATUS_META[status].dot}
                    style={{ width: `${(agencyByStatus[status] / totalAgencies) * 100}%` }}
                  />
                ) : null,
              )}
          </div>

          <dl className="grid grid-cols-3 gap-3">
            {STATUS_ORDER.map((status) => {
              const { label, dot } = AGENCY_STATUS_META[status];
              return (
                <Link
                  key={status}
                  href={`/super-admin/agencies?status=${status}`}
                  className="rounded-lg border border-slate-200 p-3 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
                    {label}
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">
                    {numberFormat.format(agencyByStatus[status])}
                  </dd>
                </Link>
              );
            })}
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-3">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Recent admin activity</h2>
          {recentAudit.length === 0 ? (
            <p className="text-sm text-slate-500">No status changes or support sessions yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentAudit.map((entry) => {
                const audit = AUDIT_META[entry.action] ?? AUDIT_META[ActivityAction.AGENCY_STATUS_CHANGED];
                const agencyName = entry.agency?.name ?? metadataString(entry.metadata, "agencyName") ?? "Deleted agency";
                const to = metadataString(entry.metadata, "to");
                return (
                  <li key={entry.id} className="flex items-start gap-3 py-3">
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${audit.tone}`}>
                      <audit.Icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800">
                        <span className="font-medium">{audit.label}</span> · {agencyName}
                        {to && <span className="text-slate-500"> → {to.toLowerCase()}</span>}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {entry.user?.email ?? "System"} · {dateTimeFormat.format(entry.createdAt)} UTC
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, Icon, hint }: { label: string; value: number; Icon: LucideIcon; hint: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
        {numberFormat.format(value)}
      </p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}
