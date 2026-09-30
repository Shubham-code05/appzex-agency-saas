import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, CalendarDays, Files, ListChecks, Video } from "lucide-react";
import { requireAgencyWorkspace } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/dates";
import { ProjectStatusBadge } from "@/components/agency/badges";
import { TasksProvider, ProjectProgress, type TaskItem } from "./_components/tasks-context";
import { TaskBoard } from "./_components/task-board";
import { CreateTaskPanel } from "./_components/create-task-panel";
import { MeetingsPanel } from "./_components/meetings-panel";
import { FilesPanel } from "./_components/files-panel";
import { AiHealthButton } from "./_components/ai-health-button";

export const metadata: Metadata = { title: "Project" };
export const dynamic = "force-dynamic";

type Tab = "tasks" | "meetings" | "files";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const workspace = await requireAgencyWorkspace();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const tab: Tab = query.tab === "meetings" || query.tab === "files" ? query.tab : "tasks";

  // Ownership check IS the query: a project from another agency is simply not
  // found, so its existence is never revealed (404 rather than 403).
  const project = await prisma.project.findFirst({
    where: { id, agencyId: workspace.agencyId },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      startDate: true,
      endDate: true,
      client: { select: { name: true, companyName: true } },
      tasks: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueDate: true,
          createdAt: true,
          assignee: { select: { id: true, name: true } },
        },
      },
      meetings: {
        orderBy: { scheduledAt: "asc" },
        select: {
          id: true,
          title: true,
          scheduledAt: true,
          durationMinutes: true,
          notes: true,
          meetingUrl: true,
          isSharedWithClient: true,
          organizer: { select: { name: true } },
        },
      },
      files: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
          isSharedWithClient: true,
          uploadedBy: { select: { name: true } },
          task: { select: { title: true } },
          feedback: { select: { title: true, content: true } },
        },
      },
    },
  });
  if (!project) notFound();

  const members = await prisma.user.findMany({
    where: { agencyId: workspace.agencyId, role: { in: ["AGENCY_ADMIN", "AGENCY_TEAM"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const now = new Date();
  const tasks: TaskItem[] = project.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    assignee: task.assignee,
  }));

  return (
    <TasksProvider tasks={tasks} nowIso={now.toISOString()}>
      <div className="space-y-6">
        <Link
          href="/agency/projects"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All projects
        </Link>

        <header className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <ProjectStatusBadge status={project.status} />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{project.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4" aria-hidden />
                  {project.client.companyName}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" aria-hidden />
                  {project.startDate ? formatDate(project.startDate) : "No start date"} →{" "}
                  {project.endDate ? formatDate(project.endDate) : "No due date"}
                </span>
              </div>
              {project.description && (
                <p className="mt-3 max-w-2xl text-sm whitespace-pre-line text-slate-600">{project.description}</p>
              )}
            </div>
            <div className="w-full shrink-0 space-y-3 lg:w-72">
              <ProjectProgress />
              <AiHealthButton projectId={project.id} projectName={project.name} />
            </div>
          </div>
        </header>

        <nav aria-label="Project sections" className="flex gap-1 border-b border-slate-200">
          <TabLink href={`/agency/projects/${project.id}`} active={tab === "tasks"} Icon={ListChecks}>
            Tasks <span className="text-slate-400 tabular-nums">{project.tasks.length}</span>
          </TabLink>
          <TabLink href={`/agency/projects/${project.id}?tab=meetings`} active={tab === "meetings"} Icon={Video}>
            Meetings <span className="text-slate-400 tabular-nums">{project.meetings.length}</span>
          </TabLink>
          <TabLink href={`/agency/projects/${project.id}?tab=files`} active={tab === "files"} Icon={Files}>
            Files <span className="text-slate-400 tabular-nums">{project.files.length}</span>
          </TabLink>
        </nav>

        {tab === "tasks" ? (
          <div className="space-y-4">
            <CreateTaskPanel projectId={project.id} members={members} />
            <TaskBoard />
          </div>
        ) : tab === "meetings" ? (
          <MeetingsPanel
            projectId={project.id}
            clientName={project.client.companyName}
            now={now}
            meetings={project.meetings}
          />
        ) : (
          <FilesPanel
            projectId={project.id}
            clientName={project.client.companyName}
            files={project.files}
            tasks={project.tasks.map((task) => ({ id: task.id, title: task.title }))}
          />
        )}
      </div>
    </TasksProvider>
  );
}

function TabLink({
  href,
  active,
  Icon,
  children,
}: {
  href: string;
  active: boolean;
  Icon: typeof ListChecks;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
        active ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {children}
    </Link>
  );
}
