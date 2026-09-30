import Link from "next/link";
import { SearchX } from "lucide-react";

/** Deliberately identical for "doesn't exist" and "belongs to another agency". */
export default function AgencyNotFound() {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <SearchX className="h-5 w-5" aria-hidden />
      </span>
      <h1 className="text-sm font-medium text-slate-900">Not found</h1>
      <p className="mt-1 mb-5 max-w-sm text-sm text-slate-500">
        This item doesn&apos;t exist or isn&apos;t part of your agency workspace.
      </p>
      <Link
        href="/agency"
        className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
