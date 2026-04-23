import { useState } from "react";
import { motion } from "framer-motion";
import type { DashboardData } from "@/lib/kpi-types";
import { KpiCard } from "./KpiCard";

const TABS = [
  { id: "performance", label: "Performance KPIs" },
  { id: "adherence", label: "Adherence" },
  { id: "experience", label: "Experience" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function KpiTabs({ data }: { data: DashboardData }) {
  const [active, setActive] = useState<TabId>("performance");
  const metrics =
    active === "performance"
      ? data.performance
      : active === "adherence"
        ? data.adherence
        : data.experience;

  return (
    <section>
      <div className="flex items-center gap-6 border-b border-border">
        {TABS.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`relative pb-3 text-sm font-semibold transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {isActive && (
                <motion.span
                  layoutId="kpi-tab-underline"
                  className="absolute left-0 right-0 -bottom-px h-[3px] rounded-full bg-primary"
                />
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {metrics.map((m, i) => (
          <KpiCard key={m.key} metric={m} index={i} />
        ))}
      </div>
    </section>
  );
}
