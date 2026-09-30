import type { Metadata } from "next";
import Link from "next/link";
import type { AgencyStatus, Prisma } from "@prisma/client";
import { Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AgencyStatusBadge } from "@/components/agency-status-badge";
import { AgencyFilters } from "./_components/agency-filters";
import { AgencyStatusControl } from "./_components/agency-status-control";
import { EnterSupportModeButton } from "./_components/enter-support-mode-button";

export const metadata: Metadata = { title: "Agencies" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const STATUSES: readonly AgencyStatus[] = ["ACTIVE", "INACTIVE", "SUSPENDED"];

const dateFormat = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

type SearchParams = Promise<{ q?: string | string[]; status?: string | string[]; page?: string | string[] }>;

function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default async function AgenciesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePageUser(["SUPER_ADMIN"]);
  const params = await searchParams;

  const q = single(params.q).trim().slice(0, 100);
  const rawStatus = single(params.status);
  const status = (STATUSES as readonly string[]).includes(rawStatus) ? (rawStatus as AgencyStatus) : null;
  const requestedPage = Math.max(1, Number.parseInt(single(params.page), 10) || 1);

  // MySQL's default collation makes `contains` case-insensitive.
  const where: Prisma.AgencyWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { users: { some: { role: "AGENCY_ADMIN", email: { contains: q } } } },
          ],
        }
      : {}),
  };

  const [total, platformTotal] = await Promise.all([prisma.agency.count({ where }), prisma.agency.count()]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);

  const agencies = await prisma.agency.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      _count: { select: { users: true, clients: true, projects: true } },
      users: {
        where: { role: "AGENCY_ADMIN" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { email: true, name: true },
      },
    },
  });

  const impersonatedAgencyId = user.impersonation?.agencyId ?? null;
  const filtered = Boolean(q || status);

  function pageHref(target: number): string {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status) sp.set("status", status);
    if (target > 1) sp.set("page", String(target));
    const qs = sp.toString();
    return qs ? `/super-admin/agencies?${qs}` : "/super-admin/agencies";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Agencies</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage tenant status and enter a workspace in Support Mode.
          </p>
        </div>
        <p className="text-sm text-slate-500">
          {filtered ? `${total} of ${platformTotal}` : platformTotal} {platformTotal === 1 ? "agency" : "agencies"}
        </p>
      </div>

      <AgencyFilters initialQuery={q} initialStatus={status ?? ""} />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {agencies.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Building2 className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-sm font-medium text-slate-900">No agencies found</p>
            <p className="mt-1 text-sm text-slate-500">
              {filtered ? "Try a different search or status filter." : "No agencies have been created yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs tracking-wider text-slate-500 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Agency</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Owner / Admin</th>
                  <th scope="col" className="px-4 py-3 font-medium">Created</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Users</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Clients</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Projects</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agencies.map((agency) => {
                  const owner = agency.users[0];
                  const isCurrent = agency.id === impersonatedAgencyId;
                  return (
                    <tr key={agency.id} className={isCurrent ? "bg-amber-50/60" : "hover:bg-slate-50/60"}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{agency.name}</p>
                        <p className="font-mono text-xs text-slate-400">{agency.id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <AgencyStatusBadge status={agency.status} />
                      </td>
                      <td className="px-4 py-3">
                        {owner ? (
                          <>
                            <p className="text-slate-900">{owner.email}</p>
                            <p className="text-xs text-slate-500">{owner.name}</p>
                          </>
                        ) : (
                          <span className="text-slate-400">No admin</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        <time dateTime={agency.createdAt.toISOString()}>{dateFormat.format(agency.createdAt)}</time>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 tabular-nums">{agency._count.users}</td>
                      <td className="px-4 py-3 text-right text-slate-700 tabular-nums">{agency._count.clients}</td>
                      <td className="px-4 py-3 text-right text-slate-700 tabular-nums">{agency._count.projects}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <AgencyStatusControl
                            key={`${agency.id}:${agency.status}`}
                            agencyId={agency.id}
                            agencyName={agency.name}
                            status={agency.status}
                          />
                          <EnterSupportModeButton agencyId={agency.id} agencyName={agency.name} isCurrent={isCurrent} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 && (
          <nav aria-label="Pagination" className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
            <p className="text-slate-500">
              Page {page} of {pageCount}
            </p>
            <div className="flex gap-2">
              <PageLink href={pageHref(page - 1)} disabled={page <= 1} label="Previous">
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </PageLink>
              <PageLink href={pageHref(page + 1)} disabled={page >= pageCount} label="Next">
                <ChevronRight className="h-4 w-4" aria-hidden />
              </PageLink>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const className = "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300";
  if (disabled) {
    return (
      <span aria-disabled className={`${className} cursor-not-allowed text-slate-300`}>
        {children}
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return (
    <Link href={href} className={`${className} text-slate-600 hover:bg-slate-50`}>
      {children}
      <span className="sr-only">{label}</span>
    </Link>
  );
}
