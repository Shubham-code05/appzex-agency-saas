import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";

export const inputClass =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none aria-[invalid=true]:border-rose-400 aria-[invalid=true]:focus:ring-rose-500/20 disabled:bg-slate-50";

/** Same input, teal focus ring — for the client portal. */
export const clientInputClass =
  "block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none aria-[invalid=true]:border-rose-400 aria-[invalid=true]:focus:ring-rose-500/20 disabled:bg-stone-50";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  optional,
  children,
  className = "",
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-slate-700">
        {label}
        {optional && <span className="text-xs font-normal text-slate-400">Optional</span>}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1 text-xs text-rose-600">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

/** Props that wire an input to its Field's error message. */
export function errorProps(id: string, error: string | undefined) {
  return error ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` } : {};
}

export function FormMessage({ result }: { result: ActionResult<unknown> | null }) {
  if (!result) return null;
  const ok = result.ok;
  const Icon = ok ? CheckCircle2 : AlertCircle;
  return (
    <p
      role={ok ? "status" : "alert"}
      className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
        ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"
      }`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      {ok ? result.message : result.error}
    </p>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-70"
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 ${props.className ?? ""}`}
    />
  );
}

export const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60";
