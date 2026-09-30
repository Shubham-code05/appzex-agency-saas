"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowUpRight, Headset, Loader2 } from "lucide-react";
import { startImpersonation } from "@/app/super-admin/actions";

export function EnterSupportModeButton({
  agencyId,
  agencyName,
  isCurrent,
}: {
  agencyId: string;
  agencyName: string;
  isCurrent: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (isCurrent) {
    return (
      <Link
        href="/agency"
        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-amber-900 ring-1 ring-amber-300 ring-inset hover:bg-amber-200"
      >
        Viewing now
        <ArrowUpRight className="h-4 w-4" aria-hidden />
      </Link>
    );
  }

  function handleClick() {
    setError(null);
    startTransition(async () => {
      // On success the action redirects to /agency and never resolves here.
      const result = await startImpersonation(agencyId);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-label={`Enter ${agencyName} in Support Mode`}
        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-white shadow-sm transition hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Headset className="h-4 w-4" aria-hidden />}
        Enter Agency (Support Mode)
      </button>
      {error && (
        <p role="alert" className="absolute top-full right-0 z-10 mt-1 w-56 rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700 shadow-sm ring-1 ring-rose-200">
          {error}
        </p>
      )}
    </div>
  );
}
