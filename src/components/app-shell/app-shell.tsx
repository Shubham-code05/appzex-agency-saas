import { LogOut, type LucideIcon } from "lucide-react";
import { SidebarNav, type NavItem } from "./sidebar-nav";

interface AppShellProps {
  brandName: string;
  brandSubtitle: string;
  BrandIcon: LucideIcon;
  navItems: NavItem[];
  userName: string;
  userDetail: string;
  children: React.ReactNode;
}

/**
 * Sidebar layout shared by the Super Admin portal and the agency workspace.
 * The sidebar is offset by --support-banner-h so it sits below the Support Mode banner.
 */
export function AppShell({ brandName, brandSubtitle, BrandIcon, navItems, userName, userDetail, children }: AppShellProps) {
  const signOut = (
    <form action="/api/auth/logout" method="post">
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
      >
        <LogOut className="h-4 w-4" aria-hidden />
        Sign out
      </button>
    </form>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-[var(--support-banner-h)] hidden h-[calc(100vh-var(--support-banner-h))] w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2.5 border-b border-slate-200 px-5 py-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <BrandIcon className="h-4.5 w-4.5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{brandName}</p>
            <p className="truncate text-xs text-slate-500">{brandSubtitle}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav items={navItems} orientation="vertical" />
        </div>
        <div className="border-t border-slate-200 px-4 py-3">
          <p className="truncate text-sm font-medium text-slate-900">{userName}</p>
          <p className="mb-2 truncate text-xs text-slate-500">{userDetail}</p>
          {signOut}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2 md:hidden">
          <div className="min-w-0 flex-1">
            <SidebarNav items={navItems} orientation="horizontal" />
          </div>
          {signOut}
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
