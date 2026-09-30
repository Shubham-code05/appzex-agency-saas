import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, Circle, Clock, ExternalLink, Flag, MessageSquarePlus, Video } from "lucide-react";
import { requireClientContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deriveProgress } from "@/lib/progress";
import { formatDate, formatDateTime, formatShortDate } from "@/lib/dates";
import { feedbackTitle } from "@/lib/feedback";
import { getClientTimeline } from "@/lib/client-timeline";
import { ProgressMeter, ProjectStatusBadge } from "@/components/agency/badges";
import { ClientTimeline } from "@/components/client/client-timeline";
import { FeedbackStatusBadge } from "@/components/feedback/feedback-status-badge";
import { FileList } from "@/components/files/file-list";

export const metadata: Metadata = { title: "Project" };
export const dynamic = "force-dynamic";

export default async function ClientProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireClientContext();
  const { id } = await params;
  const now = new Date();

  // Ownership IS the query: another client's project (same agency or not) is
  // simply not found. Meetings and files are filtered to shared-only here, at
  // the database level — internal items never leave the server.
  const project = await prisma.project.findFirst({
    where: { id, clientId: context.clientId, agencyId: context.agencyId, status: { not: "ARCHIVED" } },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      startDate: true,
      endDate: true,
      tasks: { select: { status: true } },
      milestones: { orderBy: { createdAt: "asc" }, select: { id: true, title: true, status: true, dueDate: true } },
      meetings: {
        where: { isSharedWithClient: true },
        orderBy: { scheduledAt: "desc" },
        select: { id: true, title: true, scheduledAt: true, durationMinutes: true, notes: true, meetingUrl: true },
      },
      files: {
        where: { isSharedWithClient: true },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
          uploadedBy: { select: { name: true, role: true } },
          task: { select: { title: true } },
          feedback: { select: { title: true, content: true } },
        },
      },
      feedback: {
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, title: true, content: true, status: true, updatedAt: true },
      },
    },
  });
  if (!project) notFound();

  const timeline = await getClientTimeline(context, { projectId: project.id, take: 15 });

  const done = project.tasks.filter((task) => task.status === "DONE").length;
  const progress = deriveProgress(project.tasks);
  const upcomingMeetings = project.meetings.filter((meeting) => meeting.scheduledAt >= now).reverse();
  const pastMeetings = project.meetings.filter((meeting) => meeting.scheduledAt < now);
  const milestones = [...project.milestones].sort(
    (a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity),
  );

  const files = project.files.map((file) => ({
    ...file,
    // Platform staff acting in Support Mode are presented as the agency.
    uploadedBy: file.uploadedBy
      ? { name: file.uploadedBy.role === "SUPER_ADMIN" ? context.agencyName : file.uploadedBy.name }
      : null,
    context: file.feedback
      ? `Request: ${feedbackTitle(file.feedback)}`
      : file.task
        ? `Task: ${file.task.title}`
        : null,
  }));

  return (
    <div className="space-y-8">
      <Link href="/client" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-900">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All projects
      </Link>

      <header className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <ProjectStatusBadge status={project.status} />
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{project.name}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-stone-500">
              <CalendarDays className="h-4 w-4" aria-hidden />
              {project.startDate ? formatDate(project.startDate) : "Start TBC"} →{" "}
              {project.endDate ? formatDate(project.endDate) : "Target TBC"}
            </p>
            {project.description && (
              <p className="mt-4 max-w-2xl text-sm whitespace-pre-line text-stone-600">{project.description}</p>
            )}
          </div>
          <div className="w-full shrink-0 rounded-xl bg-stone-50 p-5 lg:w-72">
            <p className="text-xs font-medium tracking-wider text-stone-500 uppercase">Completion</p>
            <p className="mt-1 mb-3 text-4xl font-semibold tracking-tight tabular-nums">{progress}%</p>
            <ProgressMeter value={progress} done={done} total={project.tasks.length} size="sm" tone="teal" />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section aria-labelledby="meetings-heading">
            <h2 id="meetings-heading" className="mb-4 text-lg font-semibold">
              Meetings
            </h2>
            {project.meetings.length === 0 ? (
              <EmptyCard Icon={Video} text="No meetings have been shared yet." />
            ) : (
              <ul className="space-y-3">
                {[...upcomingMeetings, ...pastMeetings].map((meeting) => {
                  const upcoming = meeting.scheduledAt >= now;
                  return (
                    <li key={meeting.id} className="rounded-2xl border border-stone-200 bg-white p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="font-semibold">{meeting.title}</h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            upcoming ? "bg-teal-50 text-teal-700" : "bg-stone-100 text-stone-500"
                          }`}
                        >
                          {upcoming ? "Upcoming" : "Past"}
                        </span>
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-500">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {formatDateTime(meeting.scheduledAt)} · {meeting.durationMinutes} min
                      </p>
                      {meeting.notes && (
                        <div className="mt-3 rounded-xl bg-stone-50 px-4 py-3">
                          <p className="mb-1 text-xs font-medium tracking-wider text-stone-500 uppercase">Notes</p>
                          <p className="text-sm whitespace-pre-line text-stone-700">{meeting.notes}</p>
                        </div>
                      )}
                      {meeting.meetingUrl && upcoming && (
                        <a
                          href={meeting.meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-teal-600"
                        >
                          Join meeting <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="files-heading">
            <h2 id="files-heading" className="mb-4 text-lg font-semibold">
              Shared files
            </h2>
            <FileList files={files} empty="No files have been shared yet." />
          </section>

          <section aria-labelledby="timeline-heading">
            <h2 id="timeline-heading" className="mb-4 text-lg font-semibold">
              Timeline
            </h2>
            <div className="rounded-2xl border border-stone-200 bg-white p-6">
              <ClientTimeline events={timeline} now={now} showProject={false} />
            </div>
          </section>
        </div>

        <aside className="space-y-8">
          <section aria-labelledby="milestones-heading" className="rounded-2xl border border-stone-200 bg-white p-6">
            <h2 id="milestones-heading" className="mb-4 font-semibold">
              Milestones
            </h2>
            {milestones.length === 0 ? (
              <p className="text-sm text-stone-500">No milestones yet.</p>
            ) : (
              <ul className="space-y-3">
                {milestones.map((milestone) => {
                  const complete = milestone.status === "COMPLETED";
                  return (
                    <li key={milestone.id} className="flex items-start gap-2.5">
                      {complete ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                      ) : milestone.status === "IN_PROGRESS" ? (
                        <Flag className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden />
                      ) : (
                        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-stone-300" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${complete ? "text-stone-400 line-through" : "text-stone-800"}`}>{milestone.title}</p>
                        <p className="text-xs text-stone-500">{milestone.dueDate ? formatShortDate(milestone.dueDate) : "Date TBC"}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="requests-heading" className="rounded-2xl border border-stone-200 bg-white p-6">
            <h2 id="requests-heading" className="mb-4 font-semibold">
              Your requests
            </h2>
            {project.feedback.length === 0 ? (
              <p className="mb-4 text-sm text-stone-500">No requests for this project yet.</p>
            ) : (
              <ul className="mb-4 space-y-2">
                {project.feedback.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/client/feedback/${item.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 -mx-2 text-sm hover:bg-stone-50"
                    >
                      <span className="truncate">{feedbackTitle(item)}</span>
                      <FeedbackStatusBadge status={item.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`/client/feedback?project=${project.id}#new-request`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-500"
            >
              <MessageSquarePlus className="h-4 w-4" aria-hidden />
              Request a change
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

function EmptyCard({ Icon, text }: { Icon: typeof Video; text: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-10 text-center">
      <Icon className="mb-2 h-5 w-5 text-stone-400" aria-hidden />
      <p className="text-sm text-stone-500">{text}</p>
    </div>
  );
}
