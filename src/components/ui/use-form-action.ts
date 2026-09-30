"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { ActionResult } from "@/lib/action-result";

/**
 * Submits a form to a `(formData) => Promise<ActionResult>` server action.
 *
 * Uses onSubmit rather than `<form action>` on purpose: React 19 resets form
 * fields after every action submission, which would wipe the user's input when
 * validation fails. Here the form is reset only on success.
 */
export function useFormAction<T>(
  action: (formData: FormData) => Promise<ActionResult<T>>,
  options: { onSuccess?: (result: Extract<ActionResult<T>, { ok: true }>) => void } = {},
) {
  const [result, setResult] = useState<ActionResult<T> | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      try {
        const next = await action(formData);
        setResult(next);
        if (next.ok) {
          form.reset();
          options.onSuccess?.(next);
        }
      } catch {
        setResult({ ok: false, error: "Something went wrong. Please try again." });
      }
    });
  }

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  const fieldError = (name: string): string | undefined => fieldErrors[name]?.[0];

  return { result, pending, onSubmit, fieldError, reset: () => setResult(null) };
}
