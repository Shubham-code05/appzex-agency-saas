"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { replyToFeedback } from "@/actions/client-actions";
import { clientInputClass, errorProps, FormMessage } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { FileInput } from "@/components/files/file-input";

export function ClientReplyForm({ feedbackId }: { feedbackId: string }) {
  const [inputKey, setInputKey] = useState(0);
  const { result, pending, onSubmit, fieldError } = useFormAction(replyToFeedback, {
    onSuccess: () => setInputKey((key) => key + 1),
  });

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <input type="hidden" name="feedbackId" value={feedbackId} />
      <FormMessage result={result} />
      <label htmlFor="reply-body" className="sr-only">
        Your reply
      </label>
      <textarea
        id="reply-body"
        name="body"
        required
        rows={4}
        maxLength={5000}
        placeholder="Write a reply…"
        className={clientInputClass}
        {...errorProps("reply-body", fieldError("body"))}
      />
      {fieldError("body") && (
        <p id="reply-body-error" className="text-xs text-rose-600">
          {fieldError("body")}
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <FileInput key={inputKey} id="reply-attachment" name="attachment" label="Attach a file (optional)" serverError={fieldError("attachment")} />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-500 disabled:cursor-wait disabled:opacity-70"
        >
          <Send className="h-4 w-4" aria-hidden />
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}
