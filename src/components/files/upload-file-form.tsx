"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { uploadProjectFile } from "@/actions/agency-actions";
import { Field, FormMessage, inputClass, SubmitButton } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { FileInput } from "./file-input";

/**
 * Agency upload form. Attaches to a project, and optionally to one of its tasks
 * (select shown when `tasks` is passed) or to a feedback item (`feedbackId`).
 */
export function UploadFileForm({
  projectId,
  feedbackId,
  tasks,
  defaultShared = false,
}: {
  projectId: string;
  feedbackId?: string;
  tasks?: { id: string; title: string }[];
  defaultShared?: boolean;
}) {
  // Remount the file input after each successful upload so it clears visually.
  const [inputKey, setInputKey] = useState(0);
  const { result, pending, onSubmit, fieldError } = useFormAction(uploadProjectFile, {
    onSuccess: () => setInputKey((key) => key + 1),
  });

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <input type="hidden" name="projectId" value={projectId} />
      {feedbackId && <input type="hidden" name="feedbackId" value={feedbackId} />}
      <FormMessage result={result} />

      <FileInput key={inputKey} id={`upload-${feedbackId ?? projectId}`} name="file" required serverError={fieldError("file")} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {tasks && tasks.length > 0 && (
          <Field label="Attach to task" htmlFor="upload-task" optional className="flex-1">
            <select id="upload-task" name="taskId" defaultValue="" className={inputClass}>
              <option value="">Project only</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </Field>
        )}
        <label className="flex flex-1 items-center gap-2.5 py-2 text-sm text-slate-700">
          <input type="checkbox" name="isSharedWithClient" defaultChecked={defaultShared} className="h-4 w-4 accent-teal-600" />
          Visible to client
        </label>
        <SubmitButton pending={pending}>
          <Upload className="h-4 w-4" aria-hidden />
          Upload
        </SubmitButton>
      </div>
    </form>
  );
}
