import { createContext, useContext, useState, type ReactNode } from "react";
import type { DashboardData } from "@/lib/kpi-types";
import { buildSampleDashboard } from "@/lib/kpi-engine";

interface Ctx {
  data: DashboardData;
  isSample: boolean;
  setData: (d: DashboardData) => void;
  reset: () => void;
}

const DashboardContext = createContext<Ctx | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [data, setDataState] = useState<DashboardData>(() => buildSampleDashboard());
  const [isSample, setIsSample] = useState(true);

  const setData = (d: DashboardData) => {
    setDataState(d);
    setIsSample(false);
  };
  const reset = () => {
    setDataState(buildSampleDashboard());
    setIsSample(true);
  };

  return (
    <DashboardContext.Provider value={{ data, isSample, setData, reset }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): Ctx {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
