"use client";

import { useState } from "react";
import { Paperclip } from "lucide-react";
import { ACCEPT_ATTRIBUTE, ALLOWED_EXTENSIONS, ALLOWED_EXTENSIONS_LABEL, fileExtension, formatBytes, MAX_UPLOAD_BYTES } from "@/lib/files-meta";

/**
 * File picker with instant client-side size/type feedback. The server
 * re-validates everything; this only saves a pointless 10 MB round-trip.
 */
export function FileInput({
  id,
  name,
  required = false,
  serverError,
  label = "Attach a file",
}: {
  id: string;
  name: string;
  required?: boolean;
  serverError?: string;
  label?: string;
}) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const error = localError ?? serverError;

  return (
    <div>
      <label
        htmlFor={id}
        className={`flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-3 py-3 text-sm transition hover:bg-slate-50 ${
          error ? "border-rose-300" : "border-slate-300"
        }`}
      >
        <Paperclip className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-slate-700">{selected ?? label}</span>
          <span className="block text-xs text-slate-500">
            {ALLOWED_EXTENSIONS_LABEL} · max {formatBytes(MAX_UPLOAD_BYTES)}
          </span>
        </span>
        <input
          id={id}
          name={name}
          type="file"
          required={required}
          accept={ACCEPT_ATTRIBUTE}
          className="sr-only"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            const file = event.target.files?.[0];
            const problem = file ? validateLocally(file) : null;
            setLocalError(problem);
            if (problem) event.target.value = "";
            setSelected(file && !problem ? `${file.name} (${formatBytes(file.size)})` : null);
          }}
        />
      </label>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

function validateLocally(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) {
    return `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`;
  }
  if (!ALLOWED_EXTENSIONS[fileExtension(file.name)]) {
    return `That file type isn't allowed. Upload ${ALLOWED_EXTENSIONS_LABEL}.`;
  }
  return null;
}
