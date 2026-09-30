"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { createTask } from "@/actions/agency-actions";
import { TASK_PRIORITIES, TASK_PRIORITY_LABEL, TASK_STATUSES, TASK_STATUS_LABEL } from "@/lib/agency-enums";
import { errorProps, Field, FormMessage, inputClass, primaryButtonClass, SecondaryButton, SubmitButton } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";

/**
 * Inline "quick add" panel. Stays open after a successful create (with the
 * title re-focused) so several tasks can be entered in a row.
 */
export function CreateTaskPanel({ projectId, members }: { projectId: string; members: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const { result, pending, onSubmit, fieldError, reset } = useFormAction(createTask, {
    onSuccess: () => titleRef.current?.focus(),
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className={primaryButtonClass}
      >
        <Plus className="h-4 w-4" aria-hidden />
        Add task
      </button>
    );
  }

  return (
    <section aria-label="Add task" className="rounded-xl border border-indigo-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">New task</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" aria-hidden />
          <span className="sr-only">Close</span>
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <input type="hidden" name="projectId" value={projectId} />
        <FormMessage result={result} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Title" htmlFor="task-title" error={fieldError("title")}>
            <input
              ref={titleRef}
              id="task-title"
              name="title"
              required
              maxLength={200}
              autoFocus
              placeholder="What needs to be done?"
              className={inputClass}
              {...errorProps("task-title", fieldError("title"))}
            />
          </Field>
          <Field label="Assignee" htmlFor="task-assignee" error={fieldError("assigneeId")} optional>
            <select
              id="task-assignee"
              name="assigneeId"
              defaultValue=""
              className={inputClass}
              {...errorProps("task-assignee", fieldError("assigneeId"))}
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Description" htmlFor="task-description" error={fieldError("description")} optional>
          <textarea
            id="task-description"
            name="description"
            rows={2}
            maxLength={5000}
            className={inputClass}
            {...errorProps("task-description", fieldError("description"))}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Priority" htmlFor="task-priority" error={fieldError("priority")}>
            <select id="task-priority" name="priority" defaultValue="MEDIUM" className={inputClass}>
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {TASK_PRIORITY_LABEL[priority]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status" htmlFor="task-status" error={fieldError("status")}>
            <select id="task-status" name="status" defaultValue="TODO" className={inputClass}>
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {TASK_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date" htmlFor="task-due" error={fieldError("dueDate")} optional>
            <input
              id="task-due"
              name="dueDate"
              type="date"
              className={inputClass}
              {...errorProps("task-due", fieldError("dueDate"))}
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={() => setOpen(false)}>Done</SecondaryButton>
          <SubmitButton pending={pending}>Add task</SubmitButton>
        </div>
      </form>
    </section>
  );
}
