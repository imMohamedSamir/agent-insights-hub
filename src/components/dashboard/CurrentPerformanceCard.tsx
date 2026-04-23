import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { AnimatedNumber } from "./AnimatedNumber";
import type { AgentSummary } from "@/lib/kpi-types";

const STATUS_LABEL: Record<AgentSummary["overallStatus"], string> = {
  "on-target": "On Target",
  "near-target": "Near Target",
  "off-target": "Off Target",
};

export function CurrentPerformanceCard({ summary }: { summary: AgentSummary }) {
  const pct = Math.min(100, Math.max(0, (summary.overallScore / summary.overallTarget) * 100));

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl bg-card shadow-card p-6 md:p-8"
    >
      {/* decorative wave */}
      <svg
        className="pointer-events-none absolute inset-0 w-full h-full opacity-50"
        viewBox="0 0 800 300"
        preserveAspectRatio="none"
        aria-hidden
      >
        <motion.path
          d="M0,160 C150,90 300,230 450,150 C600,80 700,200 800,130"
          fill="none"
          stroke="hsl(0 0% 0% / 0)"
          strokeWidth="2"
          style={{ stroke: "var(--primary-soft)" }}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.6, ease: "easeOut" }}
        />
      </svg>

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            Current Performance
          </p>
          <div className="mt-3 flex items-baseline gap-3">
            <AnimatedNumber
              value={summary.overallScore}
              decimals={0}
              suffix="%"
              className="text-6xl md:text-7xl font-extrabold tracking-tight text-foreground"
            />
            <span className="text-xl md:text-2xl font-semibold text-primary">
              {STATUS_LABEL[summary.overallStatus]}
            </span>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg bg-primary-soft text-primary px-3 py-2 text-xs font-bold tracking-[0.18em] uppercase">
          <AlertTriangle className="h-3.5 w-3.5" />
          Focus Area
        </div>
      </div>

      <div className="relative mt-10">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Daily Progress</span>
          <span>Target: {summary.overallTarget}%</span>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            className="h-full rounded-full bg-gradient-primary shadow-glow"
          />
        </div>
        <p className="mt-4 text-sm italic text-muted-foreground">"{summary.message}"</p>
      </div>
    </motion.section>
  );
}
