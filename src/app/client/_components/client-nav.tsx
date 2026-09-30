"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, MessageSquare } from "lucide-react";

const ITEMS = [
  // Project detail pages live under "Overview".
  { href: "/client", label: "Overview", Icon: LayoutGrid, match: (p: string) => p === "/client" || p.startsWith("/client/projects") },
  { href: "/client/feedback", label: "Requests", Icon: MessageSquare, match: (p: string) => p.startsWith("/client/feedback") },
];

export function ClientNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Client portal" className="-mb-px flex gap-6">
      {ITEMS.map(({ href, label, Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-2 border-b-2 pb-3 text-sm font-medium transition ${
              active ? "border-teal-600 text-teal-700" : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
