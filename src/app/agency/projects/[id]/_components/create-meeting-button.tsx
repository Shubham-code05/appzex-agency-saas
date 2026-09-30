"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { createMeeting } from "@/actions/agency-actions";
import { Modal } from "@/components/ui/modal";
import { errorProps, Field, FormMessage, inputClass, primaryButtonClass, SecondaryButton, SubmitButton } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";

export function CreateMeetingButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const { result, pending, onSubmit, fieldError, reset } = useFormAction(createMeeting, {
    onSuccess: () => setOpen(false),
  });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className={primaryButtonClass}
      >
        <CalendarPlus className="h-4 w-4" aria-hidden />
        Schedule meeting
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Schedule meeting" description="Times are in UTC.">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <input type="hidden" name="projectId" value={projectId} />
          {result && !result.ok && <FormMessage result={result} />}

          <Field label="Title" htmlFor="meeting-title" error={fieldError("title")}>
            <input
              id="meeting-title"
              name="title"
              required
              maxLength={200}
              autoFocus
              placeholder="Sprint review"
              className={inputClass}
              {...errorProps("meeting-title", fieldError("title"))}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Date & time (UTC)" htmlFor="meeting-at" error={fieldError("scheduledAt")} className="sm:col-span-2">
              <input
                id="meeting-at"
                name="scheduledAt"
                type="datetime-local"
                required
                className={inputClass}
                {...errorProps("meeting-at", fieldError("scheduledAt"))}
              />
            </Field>
            <Field label="Duration (min)" htmlFor="meeting-duration" error={fieldError("durationMinutes")}>
              <input
                id="meeting-duration"
                name="durationMinutes"
                type="number"
                min={5}
                max={480}
                step={5}
                defaultValue={30}
                className={inputClass}
                {...errorProps("meeting-duration", fieldError("durationMinutes"))}
              />
            </Field>
          </div>

          <Field label="Meeting link" htmlFor="meeting-url" error={fieldError("meetingUrl")} optional>
            <input
              id="meeting-url"
              name="meetingUrl"
              type="url"
              maxLength={500}
              placeholder="https://meet.example.com/…"
              className={inputClass}
              {...errorProps("meeting-url", fieldError("meetingUrl"))}
            />
          </Field>

          <Field label="Notes" htmlFor="meeting-notes" error={fieldError("notes")} optional>
            <textarea
              id="meeting-notes"
              name="notes"
              rows={4}
              maxLength={10000}
              placeholder="Agenda, decisions, follow-ups"
              className={inputClass}
              {...errorProps("meeting-notes", fieldError("notes"))}
            />
          </Field>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
            <input
              type="checkbox"
              name="isSharedWithClient"
              className="mt-0.5 h-4 w-4 accent-indigo-600"
            />
            <span>
              <span className="block text-sm font-medium text-slate-800">Share with client</span>
              <span className="block text-xs text-slate-500">The meeting and its notes become visible in the client portal.</span>
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <SecondaryButton onClick={() => setOpen(false)}>Cancel</SecondaryButton>
            <SubmitButton pending={pending}>Schedule</SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
