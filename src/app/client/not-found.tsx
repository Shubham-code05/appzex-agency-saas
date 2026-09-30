import Link from "next/link";
import { SearchX } from "lucide-react";

/** Deliberately identical for "doesn't exist" and "not yours". */
export default function ClientNotFound() {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-20 text-center">
      <SearchX className="mb-3 h-6 w-6 text-stone-400" aria-hidden />
      <h1 className="font-medium">We couldn&apos;t find that</h1>
      <p className="mt-1 mb-5 max-w-sm text-sm text-stone-500">
        It may have been removed, or it isn&apos;t shared with your account.
      </p>
      <Link href="/client" className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-100">
        Back to overview
      </Link>
    </div>
  );
}
