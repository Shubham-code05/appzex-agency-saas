import { Building2 } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import type { NavItem } from "@/components/app-shell/sidebar-nav";
import { requireAgencyWorkspace } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";

export const dynamic = "force-dynamic";

const NAV_ITEMS: NavItem[] = [
  { href: "/agency", label: "Dashboard", icon: "dashboard", exact: true },
  { href: "/agency/projects", label: "Projects", icon: "projects" },
  { href: "/agency/clients", label: "Clients", icon: "clients" },
  { href: "/agency/team", label: "Team", icon: "team" },
  { href: "/agency/feedback", label: "Feedback", icon: "feedback" },
];

/**
 * Agency workspace shell. Accessible to AGENCY_ADMIN / AGENCY_TEAM for their own
 * agency, and to a SUPER_ADMIN in Support Mode for the impersonated agency.
 * The Support Mode banner ("You are viewing … as Super Admin" + Exit button)
 * is rendered globally by the root layout, so it also appears here.
 */
export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  const workspace = await requireAgencyWorkspace();
  const { user } = workspace;

  return (
    <AppShell
      brandName={workspace.agencyName}
      brandSubtitle={workspace.supportMode ? "Support Mode" : "Agency workspace"}
      BrandIcon={Building2}
      navItems={NAV_ITEMS}
      userName={user.name}
      userDetail={workspace.supportMode ? `${ROLE_LABEL[user.role]} · ${user.email}` : ROLE_LABEL[user.role]}
    >
      {children}
    </AppShell>
  );
}
