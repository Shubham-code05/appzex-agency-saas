"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/actions/agency-actions";
import { Modal } from "@/components/ui/modal";
import { errorProps, Field, FormMessage, inputClass, primaryButtonClass, SecondaryButton, SubmitButton } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";

export function AddClientButton() {
  const [open, setOpen] = useState(false);
  const { result, pending, onSubmit, fieldError, reset } = useFormAction(createClient, {
    onSuccess: () => setOpen(false),
  });

  function openModal() {
    reset();
    setOpen(true);
  }

  return (
    <>
      <button type="button" onClick={openModal} className={primaryButtonClass}>
        <Plus className="h-4 w-4" aria-hidden />
        Add client
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add new client"
        description="The client will be added to your agency only."
      >
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {result && !result.ok && <FormMessage result={result} />}

          <Field label="Company name" htmlFor="client-company" error={fieldError("companyName")}>
            <input
              id="client-company"
              name="companyName"
              required
              maxLength={160}
              autoFocus
              placeholder="Nexus Corporation"
              className={inputClass}
              {...errorProps("client-company", fieldError("companyName"))}
            />
          </Field>

          <Field label="Display name" htmlFor="client-name" error={fieldError("name")} hint="How the client appears across the workspace.">
            <input
              id="client-name"
              name="name"
              required
              maxLength={120}
              placeholder="Nexus Corp"
              className={inputClass}
              {...errorProps("client-name", fieldError("name"))}
            />
          </Field>

          <Field label="Contact email" htmlFor="client-email" error={fieldError("contactEmail")}>
            <input
              id="client-email"
              name="contactEmail"
              type="email"
              required
              maxLength={254}
              autoComplete="off"
              placeholder="contact@nexus.com"
              className={inputClass}
              {...errorProps("client-email", fieldError("contactEmail"))}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <SecondaryButton onClick={() => setOpen(false)}>Cancel</SecondaryButton>
            <SubmitButton pending={pending}>Add client</SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
