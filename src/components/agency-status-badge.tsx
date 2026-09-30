import type { AgencyStatus } from "@prisma/client";
import { CircleCheck, CircleMinus, CircleSlash } from "lucide-react";

export const AGENCY_STATUS_META: Record<
  AgencyStatus,
  { label: string; badge: string; dot: string; Icon: typeof CircleCheck }
> = {
  ACTIVE: {
    label: "Active",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    dot: "bg-emerald-500",
    Icon: CircleCheck,
  },
  INACTIVE: {
    label: "Inactive",
    badge: "bg-slate-100 text-slate-600 ring-slate-500/20",
    dot: "bg-slate-400",
    Icon: CircleMinus,
  },
  SUSPENDED: {
    label: "Suspended",
    badge: "bg-rose-50 text-rose-700 ring-rose-600/20",
    dot: "bg-rose-500",
    Icon: CircleSlash,
  },
};

export function AgencyStatusBadge({ status }: { status: AgencyStatus }) {
  const { label, badge, Icon } = AGENCY_STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${badge}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}
