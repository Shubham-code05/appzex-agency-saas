import { ArrowRight } from "lucide-react";
import { formatDateTime } from "@/lib/dates";
import { FEEDBACK_STATUS_META, normalizeFeedbackStatus } from "@/lib/feedback";
import { Avatar } from "@/components/agency/badges";

type Author = { name: string; role: string } | null;

export interface ThreadMessage {
  id: string;
  body: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  createdAt: Date;
  author: Author;
}

interface FeedbackThreadProps {
  viewer: "client" | "agency";
  agencyName: string;
  request: { content: string; createdAt: Date; author: Author };
  messages: ThreadMessage[];
}

/**
 * Two-way conversation for a change request. Client and agency see the same
 * thread; only the author labelling differs (clients never see which platform
 * staff member acted in Support Mode — it is shown as the agency).
 */
export function FeedbackThread({ viewer, agencyName, request, messages }: FeedbackThreadProps) {
  function describeAuthor(author: Author): { name: string; tag: string; fromClient: boolean } {
    if (!author) return { name: "Former user", tag: "", fromClient: false };
    if (author.role === "CLIENT") return { name: author.name, tag: "Client", fromClient: true };
    if (author.role === "SUPER_ADMIN") {
      return viewer === "client"
        ? { name: agencyName, tag: "Support", fromClient: false }
        : { name: author.name, tag: "Appzex Support", fromClient: false };
    }
    return { name: author.name, tag: agencyName, fromClient: false };
  }

  const opener = describeAuthor(request.author);

  return (
    <ol className="space-y-4" aria-label="Conversation">
      <ThreadBubble author={opener} createdAt={request.createdAt} viewer={viewer} label="opened this request">
        {request.content}
      </ThreadBubble>

      {messages.map((message) => {
        const author = describeAuthor(message.author);
        const statusChange =
          message.fromStatus && message.toStatus ? (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              changed status
              <StatusText status={message.fromStatus} />
              <ArrowRight className="h-3 w-3 text-slate-400" aria-hidden />
              <StatusText status={message.toStatus} />
            </span>
          ) : null;

        if (!message.body) {
          return (
            <li key={message.id} className="flex items-center gap-2 pl-11 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{author.name}</span>
              {statusChange}
              <span>· {formatDateTime(message.createdAt)}</span>
            </li>
          );
        }
        return (
          <ThreadBubble key={message.id} author={author} createdAt={message.createdAt} viewer={viewer} label={statusChange}>
            {message.body}
          </ThreadBubble>
        );
      })}
    </ol>
  );
}

function ThreadBubble({
  author,
  createdAt,
  viewer,
  label,
  children,
}: {
  author: { name: string; tag: string; fromClient: boolean };
  createdAt: Date;
  viewer: "client" | "agency";
  label?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Highlight the *other* party's messages so replies stand out to the reader.
  const fromOtherParty = viewer === "client" ? !author.fromClient : author.fromClient;
  return (
    <li className="flex gap-3">
      <Avatar name={author.name} size="md" />
      <div
        className={`min-w-0 flex-1 rounded-xl border p-4 ${
          fromOtherParty ? "border-teal-200 bg-teal-50/60" : "border-slate-200 bg-white"
        }`}
      >
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span className="text-sm font-semibold text-slate-900">{author.name}</span>
          {author.tag && (
            <span
              className={`rounded px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase ${
                author.fromClient ? "bg-slate-100 text-slate-600" : "bg-teal-100 text-teal-800"
              }`}
            >
              {author.tag}
            </span>
          )}
          {label && <span>{label}</span>}
          <time className="ml-auto" dateTime={createdAt.toISOString()}>
            {formatDateTime(createdAt)}
          </time>
        </div>
        <p className="text-sm break-words whitespace-pre-line text-slate-700">{children}</p>
      </div>
    </li>
  );
}

function StatusText({ status }: { status: string }) {
  const meta = FEEDBACK_STATUS_META[normalizeFeedbackStatus(status)];
  return (
    <span className="inline-flex items-center gap-1 font-medium text-slate-700">
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
      {meta.label}
    </span>
  );
}
