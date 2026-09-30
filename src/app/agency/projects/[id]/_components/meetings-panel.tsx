import { Clock, ExternalLink, Video } from "lucide-react";
import { formatDateTime } from "@/lib/dates";
import { CreateMeetingButton } from "./create-meeting-button";
import { MeetingShareToggle } from "./meeting-share-toggle";
import { ExtractTasksButton } from "./extract-tasks-button";

interface Meeting {
  id: string;
  title: string;
  scheduledAt: Date;
  durationMinutes: number;
  notes: string | null;
  meetingUrl: string | null;
  isSharedWithClient: boolean;
  organizer: { name: string } | null;
}

export function MeetingsPanel({
  projectId,
  clientName,
  meetings,
  now,
}: {
  projectId: string;
  clientName: string;
  meetings: Meeting[];
  now: Date;
}) {
  const upcoming = meetings.filter((meeting) => meeting.scheduledAt >= now);
  const past = meetings.filter((meeting) => meeting.scheduledAt < now).reverse();

  return (
    <section aria-label="Meetings" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Meetings are internal by default. Share one to make it visible in {clientName}&apos;s portal.
        </p>
        <div className="flex flex-wrap gap-2">
          <ExtractTasksButton projectId={projectId} />
          <CreateMeetingButton projectId={projectId} />
        </div>
      </div>

      {meetings.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Video className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-sm font-medium text-slate-900">No meetings yet</p>
          <p className="mt-1 text-sm text-slate-500">Schedule kick-offs, reviews and check-ins here.</p>
        </div>
      ) : (
        <>
          <MeetingGroup projectId={projectId} title="Upcoming" meetings={upcoming} empty="No upcoming meetings." />
          {past.length > 0 && <MeetingGroup projectId={projectId} title="Past" meetings={past} muted />}
        </>
      )}
    </section>
  );
}

function MeetingGroup({
  projectId,
  title,
  meetings,
  empty,
  muted = false,
}: {
  projectId: string;
  title: string;
  meetings: Meeting[];
  empty?: string;
  muted?: boolean;
}) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">{title}</h3>
      {meetings.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {meetings.map((meeting) => (
            <li
              key={meeting.id}
              className={`rounded-xl border border-slate-200 bg-white p-5 ${muted ? "opacity-80" : ""}`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-slate-900">{meeting.title}</h4>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      <time dateTime={meeting.scheduledAt.toISOString()}>{formatDateTime(meeting.scheduledAt)}</time>
                      <span>· {meeting.durationMinutes} min</span>
                    </span>
                    {meeting.organizer && <span>Organised by {meeting.organizer.name}</span>}
                  </p>
                  {meeting.notes && (
                    <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-xs font-medium tracking-wider text-slate-500 uppercase">Notes</span>
                        <ExtractTasksButton
                          projectId={projectId}
                          initialNotes={meeting.notes}
                          sourceLabel={meeting.title}
                          variant="inline"
                        />
                      </div>
                      <p className="text-sm whitespace-pre-line text-slate-700">{meeting.notes}</p>
                    </div>
                  )}
                  {meeting.meetingUrl && (
                    <a
                      href={meeting.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      Join link
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  )}
                </div>
                <MeetingShareToggle meetingId={meeting.id} title={meeting.title} shared={meeting.isSharedWithClient} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
