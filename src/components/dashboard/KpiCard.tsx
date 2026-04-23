import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Star, BadgeCheck } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import type { KpiMetric } from "@/lib/kpi-types";

const ICONS = [TrendingUp, BadgeCheck, Star];

export function KpiCard({ metric, index = 0 }: { metric: KpiMetric; index?: number }) {
  const Icon = ICONS[index % ICONS.length];
  const positive = metric.higherIsBetter ? metric.change >= 0 : metric.change <= 0;
  const ChangeIcon = positive ? TrendingUp : TrendingDown;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 + index * 0.06 }}
      whileHover={{ y: -4 }}
      className="relative rounded-2xl bg-card shadow-card p-5 pl-6 overflow-hidden"
    >
      <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-primary" />
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground">
          {metric.label}
        </p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold tracking-tight text-foreground">
          {metric.display}
        </span>
        <span
          className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
            positive ? "text-success" : "text-primary"
          }`}
        >
          <ChangeIcon className="h-3 w-3" />
          {metric.changeDisplay}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Target: {metric.targetDisplay}</span>
        <StatusBadge status={metric.status} />
      </div>
    </motion.div>
  );
}
