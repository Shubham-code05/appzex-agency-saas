import Link from "next/link";
import { CheckCircle2, FileText, MessageSquare, Rocket, Video, type LucideIcon } from "lucide-react";
import type { ClientTimelineEvent, TimelineKind } from "@/lib/client-timeline";
import { formatRelative } from "@/lib/dates";

const KIND: Record<TimelineKind, { Icon: LucideIcon; tone: string }> = {
  project: { Icon: Rocket, tone: "bg-teal-100 text-teal-700" },
  task: { Icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-700" },
  meeting: { Icon: Video, tone: "bg-amber-100 text-amber-700" },
  file: { Icon: FileText, tone: "bg-sky-100 text-sky-700" },
  feedback: { Icon: MessageSquare, tone: "bg-violet-100 text-violet-700" },
};

export function ClientTimeline({
  events,
  now,
  showProject = true,
}: {
  events: ClientTimelineEvent[];
  now: Date;
  showProject?: boolean;
}) {
  if (events.length === 0) {
    return <p className="py-6 text-center text-sm text-stone-500">No updates yet — they&apos;ll appear here as work progresses.</p>;
  }

  return (
    <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-stone-200">
      {events.map((event) => {
        const { Icon, tone } = KIND[event.kind];
        return (
          <li key={event.id} className="relative flex gap-3">
            <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${tone}`}>
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 pt-1">
              <Link href={event.href} className="text-sm text-stone-800 hover:text-teal-700">
                {event.text}
              </Link>
              <p className="mt-0.5 text-xs text-stone-500">
                {showProject && event.projectName && <>{event.projectName} · </>}
                <time dateTime={event.createdAt.toISOString()}>{formatRelative(event.createdAt, now)}</time>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
