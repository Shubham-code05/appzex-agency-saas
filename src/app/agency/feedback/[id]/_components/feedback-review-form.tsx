"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { updateFeedbackStatus } from "@/actions/agency-actions";
import type { ActionResult } from "@/lib/action-result";
import { FEEDBACK_STATUS_META, FEEDBACK_TRANSITIONS, type FeedbackStatusValue } from "@/lib/feedback";
import { Field, FormMessage, inputClass } from "@/components/ui/form";

/**
 * Status change + official reply in one submission. Only transitions allowed
 * by the workflow are offered; the server enforces the same rules.
 */
export function FeedbackReviewForm({
  feedbackId,
  currentStatus,
}: {
  feedbackId: string;
  currentStatus: FeedbackStatusValue;
}) {
  const [status, setStatus] = useState<FeedbackStatusValue>(currentStatus);
  const [reply, setReply] = useState("");
  const [result, setResult] = useState<ActionResult<unknown> | null>(null);
  const [pending, startTransition] = useTransition();

  const options: FeedbackStatusValue[] = [currentStatus, ...FEEDBACK_TRANSITIONS[currentStatus]];
  const replyError = result && !result.ok ? result.fieldErrors?.replyText?.[0] : undefined;
  const replyRequired = status === "DECLINED" && currentStatus !== "DECLINED";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    startTransition(async () => {
      const next = await updateFeedbackStatus(feedbackId, status, reply);
      setResult(next);
      if (next.ok) setReply("");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormMessage result={result} />

      <Field label="Status" htmlFor="review-status">
        <select
          id="review-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as FeedbackStatusValue)}
          className={inputClass}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option === currentStatus ? `${FEEDBACK_STATUS_META[option].label} (current)` : FEEDBACK_STATUS_META[option].label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Reply to client"
        htmlFor="review-reply"
        error={replyError}
        optional={!replyRequired}
        hint={replyRequired ? "Required: let the client know why." : "The client sees this in their portal."}
      >
        <textarea
          id="review-reply"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={4}
          maxLength={5000}
          placeholder="Write an official reply…"
          className={inputClass}
          aria-invalid={replyError ? true : undefined}
          aria-describedby={replyError ? "review-reply-error" : undefined}
        />
      </Field>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || (status === currentStatus && !reply.trim())}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
          {status !== currentStatus ? (reply.trim() ? "Update & reply" : "Update status") : "Send reply"}
        </button>
      </div>
    </form>
  );
}
