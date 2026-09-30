"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  Building2,
  FolderKanban,
  LayoutDashboard,
  MessageSquareText,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Icons are referenced by name because components can't cross the server → client boundary. */
const ICONS = {
  dashboard: LayoutDashboard,
  agencies: Building2,
  projects: FolderKanban,
  clients: Briefcase,
  team: Users,
  feedback: MessageSquareText,
} satisfies Record<string, LucideIcon>;

export type NavIconName = keyof typeof ICONS;

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
  /** Match only the exact path (for section roots like /agency). */
  exact?: boolean;
}

export function SidebarNav({ items, orientation }: { items: NavItem[]; orientation: "vertical" | "horizontal" }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className={orientation === "vertical" ? "space-y-1" : "flex gap-1 overflow-x-auto [scrollbar-width:none]"}
    >
      {items.map(({ href, label, icon, exact }) => {
        const Icon = ICONS[icon];
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
              active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
