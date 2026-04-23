import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Upload, Bell, RefreshCw, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

interface AppShellProps {
  title: string;
  agentName?: string;
  agentRole?: string;
  date?: string;
  children: React.ReactNode;
}

const nav = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/upload", label: "Upload Data", icon: Upload },
] as const;

export function AppShell({
  title,
  agentName = "Aley Rivera",
  agentRole = "TIER 2 SUPPORT",
  date,
  children,
}: AppShellProps) {
  const location = useLocation();
  const formattedDate = date
    ? format(new Date(date), "MMM d, yyyy")
    : format(new Date(), "MMM d, yyyy");

  return (
    <div className="min-h-screen w-full bg-background flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="px-6 pt-7 pb-8">
          <h1 className="text-xl font-bold text-primary leading-tight">Score Card Tool</h1>
          <p className="mt-1 text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
            Command Center
          </p>
        </div>
        <nav className="px-4 flex flex-col gap-1.5">
          {nav.map((item) => {
            const active =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  active
                    ? "bg-card text-primary shadow-card"
                    : "text-sidebar-foreground/80 hover:bg-card/60 hover:text-primary"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-center justify-between gap-4 px-6 md:px-10 pt-6 pb-2">
          <div className="flex items-center gap-4">
            <h2 className="text-lg md:text-xl font-extrabold tracking-[0.18em] text-foreground">
              {title}
            </h2>
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-card border border-border px-3 py-1.5 text-xs text-muted-foreground shadow-card">
              <CalendarDays className="h-3.5 w-3.5" />
              {formattedDate}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Refresh"
              className="h-9 w-9 grid place-items-center rounded-full text-primary hover:bg-primary-soft transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Notifications"
              className="relative h-9 w-9 grid place-items-center rounded-full text-primary hover:bg-primary-soft transition-colors"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
            </button>
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right leading-tight">
                <div className="text-sm font-semibold">{agentName}</div>
                <div className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
                  {agentRole}
                </div>
              </div>
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="h-10 w-10 rounded-full bg-gradient-primary text-primary-foreground grid place-items-center font-semibold shadow-elegant"
              >
                {agentName
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </motion.div>
            </div>
          </div>
        </header>
        <main className="flex-1 px-6 md:px-10 pb-12">{children}</main>
      </div>
    </div>
  );
}
