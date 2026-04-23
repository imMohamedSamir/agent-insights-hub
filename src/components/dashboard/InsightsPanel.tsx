import { motion } from "framer-motion";
import { Lightbulb, AlertCircle, CheckCircle2, Brain } from "lucide-react";
import type { AgentInsight } from "@/lib/kpi-types";

const ICONS = {
  alert: AlertCircle,
  goal: CheckCircle2,
  tip: Brain,
} as const;

export function InsightsPanel({ insights }: { insights: AgentInsight[] }) {
  return (
    <motion.aside
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="rounded-2xl bg-card shadow-card p-6 flex flex-col"
    >
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-primary-soft text-primary grid place-items-center">
          <Lightbulb className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-bold tracking-[0.18em] uppercase text-foreground">
          Agent Insights
        </h3>
      </div>
      <div className="mt-5 flex flex-col gap-3 flex-1">
        {insights.map((ins, i) => {
          const Icon = ICONS[ins.type];
          return (
            <motion.div
              key={`${ins.type}-${i}`}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.2 + i * 0.08 }}
              className="rounded-xl bg-primary-soft/40 p-4"
            >
              <div className="flex items-start gap-3">
                <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{ins.title}</h4>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{ins.body}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      <button
        type="button"
        className="mt-5 w-full rounded-xl border border-primary/30 text-primary text-xs font-bold tracking-[0.18em] uppercase py-3 hover:bg-primary-soft transition-colors"
      >
        View Coaching Plan
      </button>
    </motion.aside>
  );
}
