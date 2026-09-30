import type { Metadata } from "next";
import { Mail, Users } from "lucide-react";
import { requireAgencyWorkspace } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dueWindow } from "@/lib/dates";
import { ROLE_LABEL } from "@/lib/roles";
import { Avatar } from "@/components/agency/badges";

export const metadata: Metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { agencyId } = await requireAgencyWorkspace();
  const { today } = dueWindow();

  const members = await prisma.user.findMany({
    where: { agencyId, role: { in: ["AGENCY_ADMIN", "AGENCY_TEAM"] } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      _count: {
        select: {
          // Scoped to this agency's projects, even though assignees are already same-agency.
          assignedTasks: { where: { status: { not: "DONE" }, project: { agencyId } } },
        },
      },
      assignedTasks: {
        where: { status: { not: "DONE" }, dueDate: { lt: today }, project: { agencyId } },
        select: { id: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Team</h1>
        <p className="mt-1 text-sm text-slate-500">
          {members.length} {members.length === 1 ? "member" : "members"} in this workspace.
        </p>
      </div>

      {members.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <Users className="mb-3 h-6 w-6 text-slate-400" aria-hidden />
          <p className="text-sm text-slate-500">No team members yet.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {members.map((member) => (
            <li key={member.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <Avatar name={member.name} size="md" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{member.name}</p>
                  <p className="text-xs text-slate-500">{ROLE_LABEL[member.role]}</p>
                </div>
              </div>
              <a
                href={`mailto:${member.email}`}
                className="mt-4 flex items-center gap-1.5 truncate text-sm text-slate-600 hover:text-indigo-600"
              >
                <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                {member.email}
              </a>
              <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
                <div>
                  <dt className="text-xs text-slate-500">Open tasks</dt>
                  <dd className="text-lg font-semibold text-slate-900 tabular-nums">{member._count.assignedTasks}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Overdue</dt>
                  <dd
                    className={`text-lg font-semibold tabular-nums ${
                      member.assignedTasks.length > 0 ? "text-rose-600" : "text-slate-900"
                    }`}
                  >
                    {member.assignedTasks.length}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
