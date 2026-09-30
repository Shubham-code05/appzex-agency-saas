import Link from "next/link";
import { ArrowUpRight, ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { AGENCY_STATUS_META } from "@/components/agency-status-badge";
import { ExitSupportModeButton } from "./exit-support-mode-button";

/**
 * Rendered by the root layout, so it appears on every page while a Super Admin
 * is in Support Mode. Impersonation state is re-verified against the database
 * on each request by getCurrentUser().
 */
export async function SupportModeBanner() {
  const user = await getCurrentUser();
  const impersonation = user?.role === "SUPER_ADMIN" ? user.impersonation : null;
  if (!impersonation) return null;

  const status = AGENCY_STATUS_META[impersonation.agencyStatus];
  const expiresAt = impersonation.expiresAt.toISOString().slice(11, 16);

  return (
    <div
      data-support-banner
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 border-b border-amber-500/40 bg-amber-400 text-amber-950 shadow-sm md:h-12"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 md:h-full md:flex-nowrap md:py-0">
        <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1 text-sm md:truncate">
          You are viewing <strong className="font-semibold">{impersonation.agencyName}</strong> as Super Admin
          (Support Mode)
          {impersonation.agencyStatus !== "ACTIVE" && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-950/10 px-2 py-0.5 text-xs font-medium">
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden />
              {status.label}
            </span>
          )}
          <span className="ml-2 hidden text-xs text-amber-900/80 sm:inline">
            · actions are audited · expires {expiresAt} UTC
          </span>
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/agency"
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium hover:bg-amber-950/10 focus-visible:ring-2 focus-visible:ring-amber-950 focus-visible:outline-none"
          >
            Workspace
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
          <ExitSupportModeButton />
        </div>
      </div>
    </div>
  );
}
