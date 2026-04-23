import type { KpiStatus } from "@/lib/kpi-types";

const MAP: Record<KpiStatus, { label: string; cls: string }> = {
  "on-target": {
    label: "ON TARGET",
    cls: "bg-success/10 text-success",
  },
  "near-target": {
    label: "NEAR TARGET",
    cls: "bg-primary-soft text-primary",
  },
  "off-target": {
    label: "OFF TARGET",
    cls: "bg-primary-soft text-primary",
  },
};

export function StatusBadge({ status }: { status: KpiStatus }) {
  const info = MAP[status];
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] ${info.cls}`}
    >
      {info.label}
    </span>
  );
}
