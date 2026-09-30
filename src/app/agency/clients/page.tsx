import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, Mail } from "lucide-react";
import { requireAgencyWorkspace } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/dates";
import { AddClientButton } from "./_components/add-client-button";

export const metadata: Metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const { agencyId } = await requireAgencyWorkspace();

  const clients = await prisma.client.findMany({
    where: { agencyId },
    orderBy: { companyName: "asc" },
    select: {
      id: true,
      name: true,
      companyName: true,
      contactEmail: true,
      createdAt: true,
      _count: { select: { projects: true, users: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Clients</h1>
          <p className="mt-1 text-sm text-slate-500">
            {clients.length} {clients.length === 1 ? "company" : "companies"} you deliver work for.
          </p>
        </div>
        <AddClientButton />
      </div>

      {clients.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Briefcase className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-sm font-medium text-slate-900">No clients yet</p>
          <p className="mt-1 mb-4 text-sm text-slate-500">Add your first client to start creating projects for them.</p>
          <AddClientButton />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs tracking-wider text-slate-500 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Company</th>
                  <th scope="col" className="px-4 py-3 font-medium">Contact email</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Projects</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Portal users</th>
                  <th scope="col" className="px-4 py-3 font-medium">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{client.companyName}</p>
                      <p className="text-xs text-slate-500">{client.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`mailto:${client.contactEmail}`}
                        className="inline-flex items-center gap-1.5 text-slate-700 hover:text-indigo-600"
                      >
                        <Mail className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                        {client.contactEmail}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {client._count.projects > 0 ? (
                        <Link href="/agency/projects" className="font-medium text-indigo-600 hover:text-indigo-500">
                          {client._count.projects}
                        </Link>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 tabular-nums">{client._count.users}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(client.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
