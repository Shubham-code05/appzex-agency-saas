import type { Metadata } from "next";
import Link from "next/link";
import { AlarmClock, CalendarDays, FolderKanban } from "lucide-react";
import { requireAgencyWorkspace } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deriveProgress } from "@/lib/progress";
import { formatDate, startOfUtcDay } from "@/lib/dates";
import { ProgressMeter, ProjectStatusBadge } from "@/components/agency/badges";
import { CreateProjectButton } from "./_components/create-project-button";

export const metadata: Metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

const STATUS_ORDER: Record<string, number> = { ACTIVE: 0, PLANNING: 1, ON_HOLD: 2, COMPLETED: 3, ARCHIVED: 4 };

export default async function ProjectsPage() {
  const { agencyId } = await requireAgencyWorkspace();
  const today = startOfUtcDay();

  const [projects, clients] = await Promise.all([
    prisma.project.findMany({
      where: { agencyId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        endDate: true,
        client: { select: { companyName: true } },
        tasks: { select: { status: true } },
      },
    }),
    prisma.client.findMany({
      where: { agencyId },
      orderBy: { companyName: "asc" },
      select: { id: true, companyName: true },
    }),
  ]);

  const sorted = [...projects].sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Projects</h1>
          <p className="mt-1 text-sm text-slate-500">
            Progress is derived from completed tasks — it updates as work gets done.
          </p>
        </div>
        <CreateProjectButton clients={clients} />
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <FolderKanban className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-sm font-medium text-slate-900">No projects yet</p>
          <p className="mt-1 mb-4 text-sm text-slate-500">
            {clients.length === 0 ? "Add a client first, then create a project for them." : "Create your first project."}
          </p>
          <CreateProjectButton clients={clients} />
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((project) => {
            const done = project.tasks.filter((task) => task.status === "DONE").length;
            const progress = deriveProgress(project.tasks);
            const isLate =
              project.endDate !== null &&
              project.endDate < today &&
              project.status !== "COMPLETED" &&
              project.status !== "ARCHIVED";

            return (
              <li key={project.id}>
                <Link
                  href={`/agency/projects/${project.id}`}
                  className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <p className="truncate text-xs font-medium tracking-wider text-slate-500 uppercase">
                      {project.client.companyName}
                    </p>
                    <ProjectStatusBadge status={project.status} />
                  </div>
                  <h2 className="mb-1 line-clamp-2 font-semibold text-slate-900">{project.name}</h2>
                  <p className={`mb-5 flex items-center gap-1.5 text-xs ${isLate ? "font-medium text-rose-600" : "text-slate-500"}`}>
                    {isLate ? (
                      <AlarmClock className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {project.endDate ? `Due ${formatDate(project.endDate)}` : "No due date"}
                    {isLate && " · past due"}
                  </p>
                  <div className="mt-auto">
                    <ProgressMeter value={progress} done={done} total={project.tasks.length} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
