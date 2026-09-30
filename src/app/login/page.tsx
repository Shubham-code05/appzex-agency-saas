import type { Metadata } from "next";
import { isSessionEndReason, SESSION_END_REASONS } from "@/lib/session-reasons";
import { LoginForm, type DemoAccount } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const DEMO_PASSWORD = "Password123!";

// Lives in the server component so credentials only reach the client bundle
// when demo mode is enabled.
const DEMO_ACCOUNTS: DemoAccount[] = [
  { label: "Super Admin", detail: "Platform owner", email: "superadmin@appzex.com", tone: "violet" },
  { label: "Agency A Admin", detail: "Apex Digital", email: "admin@apex.com", tone: "indigo" },
  { label: "Agency B Admin", detail: "Zenith Creative", email: "admin@zenith.com", tone: "sky" },
  { label: "Client", detail: "Nexus Corp · Apex", email: "client@nexus.com", tone: "emerald" },
  { label: "Team Member", detail: "Apex Digital", email: "dev@apex.com", tone: "slate" },
  { label: "Client B", detail: "Acme Ltd · Zenith", email: "client@acme.com", tone: "teal" },
  { label: "Suspended Admin", detail: "Ghost Labs · expect 403", email: "admin@ghost.com", tone: "rose" },
].map((account) => ({ ...account, password: DEMO_PASSWORD }) as DemoAccount);

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; reason?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const reason = isSessionEndReason(params.reason) ? SESSION_END_REASONS[params.reason] : undefined;

  const showDemo = process.env.NODE_ENV !== "production" || process.env.ENABLE_DEMO_LOGIN === "true";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-indigo-100),transparent_60%)]"
      />
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-lg font-semibold text-white shadow-sm">
            A
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in to Appzex</h1>
          <p className="mt-1 text-sm text-slate-500">Agency project management, one workspace per tenant.</p>
        </div>

        <LoginForm next={next} notice={reason} demoAccounts={showDemo ? DEMO_ACCOUNTS : []} />
      </div>
    </main>
  );
}
