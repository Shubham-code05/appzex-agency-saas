"use client";

import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { submitClientFeedback } from "@/actions/client-actions";
import { clientInputClass as clientInput, errorProps, Field, FormMessage } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { FileInput } from "@/components/files/file-input";

export function FeedbackForm({
  projects,
  defaultProjectId,
}: {
  projects: { id: string; name: string }[];
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const { result, pending, onSubmit, fieldError } = useFormAction(submitClientFeedback, {
    onSuccess: (res) => {
      if (res.data?.id) router.push(`/client/feedback/${res.data.id}`);
    },
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {result && !result.ok && <FormMessage result={result} />}

      <Field label="Project" htmlFor="fb-project" error={fieldError("projectId")}>
        <select
          id="fb-project"
          name="projectId"
          required
          defaultValue={defaultProjectId ?? (projects.length === 1 ? projects[0].id : "")}
          className={clientInput}
          {...errorProps("fb-project", fieldError("projectId"))}
        >
          <option value="" disabled>
            Select a project…
          </option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Title" htmlFor="fb-title" error={fieldError("title")}>
        <input
          id="fb-title"
          name="title"
          required
          maxLength={200}
          placeholder="e.g. Make the homepage headline bolder"
          className={clientInput}
          {...errorProps("fb-title", fieldError("title"))}
        />
      </Field>

      <Field label="Description" htmlFor="fb-description" error={fieldError("description")}>
        <textarea
          id="fb-description"
          name="description"
          required
          rows={5}
          maxLength={5000}
          placeholder="What would you like changed, and why?"
          className={clientInput}
          {...errorProps("fb-description", fieldError("description"))}
        />
      </Field>

      <FileInput id="fb-attachment" name="attachment" label="Attach a file (optional)" serverError={fieldError("attachment")} />

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-500 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-70"
      >
        <Send className="h-4 w-4" aria-hidden />
        {pending ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}
