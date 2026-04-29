import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone, Ticket, Clock, Handshake, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { AppShell } from "@/components/AppShell";
import { CurrentPerformanceCard } from "@/components/dashboard/CurrentPerformanceCard";
import { StatTile } from "@/components/dashboard/StatTile";
import { KpiTabs } from "@/components/dashboard/KpiTabs";
import { PerformanceTrend } from "@/components/dashboard/PerformanceTrend";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";
import { useDashboard } from "@/state/dashboard-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — Score Card Tool" },
      {
        name: "description",
        content:
          "Animated agent performance overview with KPIs, trends and coaching insights.",
      },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const { data, isSample, selectedAgent, selectAgent, setSearchTerm } = useDashboard();
  const { summary } = data;

  const clearSelection = () => {
    selectAgent(null);
    setSearchTerm("");
  };

  return (
    <AppShell
      title="AGENT WORKSPACE"
      agentName={summary.name}
      agentRole={summary.role}
      date={summary.date}
    >
      {isSample && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex items-center justify-between gap-4 rounded-xl bg-primary-soft text-primary px-4 py-3 text-sm"
        >
          <span className="inline-flex items-center gap-2 font-medium">
            <Sparkles className="h-4 w-4" />
            Showing sample data — upload your Excel files to see real KPIs.
          </span>
          <Link
            to="/upload"
            className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-bold tracking-[0.12em] uppercase hover:opacity-90"
          >
            Upload Data
          </Link>
        </motion.div>
      )}

      {selectedAgent && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex items-center justify-between gap-4 rounded-xl bg-card border border-border px-4 py-2.5 text-sm shadow-card"
        >
          <span className="text-muted-foreground">
            Viewing{" "}
            <span className="font-semibold text-foreground">{selectedAgent.name}</span>
            <span className="text-muted-foreground"> · {selectedAgent.employeeId}</span>
          </span>
          <button
            type="button"
            onClick={clearSelection}
            className="inline-flex items-center gap-1.5 rounded-lg text-primary hover:bg-primary-soft px-2.5 py-1 text-xs font-semibold transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={selectedAgent?.employeeId ?? "__aggregate__"}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5">
            <CurrentPerformanceCard summary={summary} />
            <div className="grid grid-cols-2 gap-4">
              <StatTile icon={Phone} label="Total Calls" value={summary.totalCalls} index={0} />
              <StatTile icon={Ticket} label="Closed Tickets" value={summary.closedTickets} index={1} />
              <StatTile
                icon={Clock}
                label="Working Hours"
                value={summary.workingHours}
                decimals={1}
                suffix="h"
                index={2}
              />
              <StatTile
                icon={Handshake}
                label="Adherence"
                value={summary.adherence}
                decimals={0}
                suffix="%"
                index={3}
              />
            </div>
          </div>

          <div className="mt-8">
            <KpiTabs data={data} />
          </div>

          <div className="mt-8 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
            {/* <PerformanceTrend data={data.trend} /> */}
            <InsightsPanel insights={data.insights} />
          </div>
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}
