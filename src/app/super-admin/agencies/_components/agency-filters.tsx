"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ChevronDown, Loader2, Search, X } from "lucide-react";

const SEARCH_DEBOUNCE_MS = 300;

export function AgencyFilters({ initialQuery, initialStatus }: { initialQuery: string; initialStatus: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);

  function navigate(nextQuery: string, nextStatus: string) {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextStatus) params.set("status", nextStatus);
    const qs = params.toString();
    // Filters always reset pagination to page 1.
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  useEffect(() => {
    // Skip when the box already matches the URL (initial mount, or after navigation).
    if (query.trim() === initialQuery) return;
    const timer = setTimeout(() => navigate(query, status), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // Only the query is debounced; status changes navigate immediately.
  }, [query, initialQuery]);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        navigate(query, status);
      }}
      className="flex flex-col gap-3 sm:flex-row"
    >
      <label className="relative flex-1">
        <span className="sr-only">Search by agency name or admin email</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={100}
          placeholder="Search by agency name or admin email…"
          className="block w-full rounded-lg border border-slate-300 bg-white py-2 pr-9 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {pending ? (
          <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" aria-hidden />
        ) : (
          query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">Clear search</span>
            </button>
          )
        )}
      </label>

      <label className="relative sm:w-48">
        <span className="sr-only">Filter by status</span>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            navigate(query, e.target.value);
          }}
          className="block w-full appearance-none rounded-lg border border-slate-300 bg-white py-2 pr-9 pl-3 text-sm text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
      </label>
    </form>
  );
}
