"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { updateMeetingSharing } from "@/actions/agency-actions";

export function MeetingShareToggle({ meetingId, title, shared }: { meetingId: string; title: string; shared: boolean }) {
  const [optimisticShared, setOptimisticShared] = useOptimistic(shared);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !optimisticShared;
    setError(null);
    startTransition(async () => {
      setOptimisticShared(next);
      const result = await updateMeetingSharing(meetingId, next);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        role="switch"
        aria-checked={optimisticShared}
        aria-label={`Share "${title}" with client`}
        onClick={toggle}
        disabled={pending}
        className="group inline-flex items-center gap-2.5 rounded-lg py-1 text-sm font-medium text-slate-700 disabled:cursor-wait"
      >
        <span
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
            optimisticShared ? "bg-teal-500" : "bg-slate-300"
          } group-focus-visible:ring-2 group-focus-visible:ring-indigo-500 group-focus-visible:ring-offset-2`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${
              optimisticShared ? "translate-x-4.5" : "translate-x-0.5"
            }`}
          />
        </span>
        <span className="inline-flex items-center gap-1">
          {optimisticShared ? (
            <Eye className="h-3.5 w-3.5 text-teal-600" aria-hidden />
          ) : (
            <EyeOff className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          )}
          {optimisticShared ? "Shared with client" : "Internal only"}
        </span>
      </button>
      {error && (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
