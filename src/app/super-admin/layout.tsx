import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import type { NavItem } from "@/components/app-shell/sidebar-nav";
import { requirePageUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NAV_ITEMS: NavItem[] = [
  { href: "/super-admin", label: "Dashboard", icon: "dashboard", exact: true },
  { href: "/super-admin/agencies", label: "Agencies", icon: "agencies" },
];

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  // Defence in depth: middleware already gates /super-admin/*, and each page
  // re-checks too because layouts are not re-rendered on client navigation.
  const user = await requirePageUser(["SUPER_ADMIN"]);

  return (
    <AppShell
      brandName="Appzex"
      brandSubtitle="Platform admin"
      BrandIcon={ShieldCheck}
      navItems={NAV_ITEMS}
      userName={user.name}
      userDetail={user.email}
    >
      {children}
    </AppShell>
  );
}
