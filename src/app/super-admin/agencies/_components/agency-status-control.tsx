"use client";

import { useState, useTransition } from "react";
import type { AgencyStatus } from "@prisma/client";
import { ChevronDown, Loader2 } from "lucide-react";
import { updateAgencyStatus } from "@/app/super-admin/actions";

const OPTIONS: { value: AgencyStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "SUSPENDED", label: "Suspended" },
];

const CONFIRM_COPY: Partial<Record<AgencyStatus, (name: string) => string>> = {
  SUSPENDED: (name) =>
    `Suspend ${name}?\n\nEvery user in this agency (admins, team and clients) will be blocked from signing in, and any open session will stop working on its next request.`,
  INACTIVE: (name) =>
    `Deactivate ${name}?\n\nEvery user in this agency will lose access until it is reactivated.`,
};

/**
 * Remounted (via `key`) whenever the server status changes, so local state is
 * always seeded from the latest server value.
 */
export function AgencyStatusControl({
  agencyId,
  agencyName,
  status,
}: {
  agencyId: string;
  agencyName: string;
  status: AgencyStatus;
}) {
  const [value, setValue] = useState<AgencyStatus>(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleChange(next: AgencyStatus) {
    if (next === value) return;
    const confirmCopy = CONFIRM_COPY[next];
    if (confirmCopy && !window.confirm(confirmCopy(agencyName))) return;

    const previous = value;
    setValue(next); // optimistic
    setError(null);
    startTransition(async () => {
      const result = await updateAgencyStatus(agencyId, next);
      if (!result.ok) {
        setValue(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="relative">
      <label className="relative block">
        <span className="sr-only">Change status for {agencyName}</span>
        <select
          value={value}
          disabled={pending}
          onChange={(e) => handleChange(e.target.value as AgencyStatus)}
          className="block w-32 appearance-none rounded-lg border border-slate-300 bg-white py-1.5 pr-8 pl-2.5 text-sm text-slate-700 transition hover:border-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none disabled:cursor-wait disabled:opacity-60"
        >
          {OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {pending ? (
          <Loader2 className="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" aria-hidden />
        ) : (
          <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
        )}
      </label>
      {error && (
        <p role="alert" className="absolute top-full right-0 z-10 mt-1 w-56 rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700 shadow-sm ring-1 ring-rose-200">
          {error}
        </p>
      )}
    </div>
  );
}
