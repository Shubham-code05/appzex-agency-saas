"use client";

import { useState, useTransition } from "react";
import { Loader2, LogOut } from "lucide-react";
import { stopImpersonation } from "@/app/super-admin/actions";

export function ExitSupportModeButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleExit() {
    setError(null);
    startTransition(async () => {
      // On success the action redirects to /super-admin/agencies and never resolves here.
      const result = await stopImpersonation();
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs font-medium text-rose-800">{error}</span>}
      <button
        type="button"
        onClick={handleExit}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md bg-amber-950 px-3 py-1.5 text-sm font-semibold text-amber-50 shadow-sm transition hover:bg-amber-900 focus-visible:ring-2 focus-visible:ring-amber-950 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-400 focus-visible:outline-none disabled:opacity-70"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LogOut className="h-4 w-4" aria-hidden />}
        Exit Support Mode
      </button>
    </div>
  );
}
