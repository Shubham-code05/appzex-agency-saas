"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { createProject } from "@/actions/agency-actions";
import { Modal } from "@/components/ui/modal";
import { errorProps, Field, FormMessage, inputClass, primaryButtonClass, SecondaryButton, SubmitButton } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { PROJECT_STATUS_LABEL } from "@/components/agency/badges";
import { PROJECT_STATUSES } from "@/lib/agency-enums";

export function CreateProjectButton({ clients }: { clients: { id: string; companyName: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { result, pending, onSubmit, fieldError, reset } = useFormAction(createProject, {
    onSuccess: (res) => {
      setOpen(false);
      if (res.data?.id) router.push(`/agency/projects/${res.data.id}`);
    },
  });

  if (clients.length === 0) {
    return (
      <Link href="/agency/clients" className={primaryButtonClass}>
        <Plus className="h-4 w-4" aria-hidden />
        Add a client first
      </Link>
    );
  }

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
        <Plus className="h-4 w-4" aria-hidden />
        New project
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Create new project" description="Projects belong to one of your agency's clients.">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {result && !result.ok && <FormMessage result={result} />}

          <Field label="Project name" htmlFor="project-name" error={fieldError("name")}>
            <input
              id="project-name"
              name="name"
              required
              maxLength={160}
              autoFocus
              placeholder="Website redesign"
              className={inputClass}
              {...errorProps("project-name", fieldError("name"))}
            />
          </Field>

          <Field label="Client" htmlFor="project-client" error={fieldError("clientId")}>
            <select
              id="project-client"
              name="clientId"
              required
              defaultValue=""
              className={inputClass}
              {...errorProps("project-client", fieldError("clientId"))}
            >
              <option value="" disabled>
                Select a client…
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.companyName}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Description" htmlFor="project-description" error={fieldError("description")} optional>
            <textarea
              id="project-description"
              name="description"
              rows={3}
              maxLength={5000}
              placeholder="Scope, goals and key deliverables"
              className={inputClass}
              {...errorProps("project-description", fieldError("description"))}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Status" htmlFor="project-status" error={fieldError("status")}>
              <select id="project-status" name="status" defaultValue="ACTIVE" className={inputClass}>
                {PROJECT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {PROJECT_STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Start date" htmlFor="project-start" error={fieldError("startDate")} optional>
              <input
                id="project-start"
                name="startDate"
                type="date"
                className={inputClass}
                {...errorProps("project-start", fieldError("startDate"))}
              />
            </Field>
            <Field label="Due date" htmlFor="project-due" error={fieldError("dueDate")} optional>
              <input
                id="project-due"
                name="dueDate"
                type="date"
                className={inputClass}
                {...errorProps("project-due", fieldError("dueDate"))}
              />
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <SecondaryButton onClick={() => setOpen(false)}>Cancel</SecondaryButton>
            <SubmitButton pending={pending}>Create project</SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
