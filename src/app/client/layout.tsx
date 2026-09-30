import { LogOut } from "lucide-react";
import { requireClientContext } from "@/lib/auth";
import { initials } from "@/components/agency/badges";
import { ClientNav } from "./_components/client-nav";

export const dynamic = "force-dynamic";

/**
 * Client portal shell: a light, top-navigation layout deliberately distinct
 * from the internal sidebar workspace. Only CLIENT users get past
 * requireClientContext() — middleware also redirects every other role away.
 */
export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const context = await requireClientContext();

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm font-semibold text-white">
                {initials(context.companyName)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{context.companyName}</p>
                <p className="truncate text-xs text-stone-500">Client portal · {context.agencyName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-stone-600 sm:inline">{context.user.name}</span>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">Log out</span>
                  <span className="sr-only sm:hidden">Log out</span>
                </button>
              </form>
            </div>
          </div>
          <ClientNav />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
