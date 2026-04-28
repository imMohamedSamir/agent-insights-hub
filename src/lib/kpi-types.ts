export type KpiStatus = "on-target" | "near-target" | "off-target";

export interface KpiMetric {
  key: string;
  label: string;
  value: number;
  display: string;
  change: number; // delta vs previous period
  changeDisplay: string;
  target: number;
  targetDisplay: string;
  status: KpiStatus;
  higherIsBetter: boolean;
}

export interface TrendPoint {
  day: string; // MON..SUN
  date: string; // ISO
  score: number;
  target: number;
}

export interface AgentInsight {
  type: "alert" | "goal" | "tip";
  title: string;
  body: string;
}

export interface AgentSummary {
  name: string;
  employeeId: string;
  role: string;
  date: string;
  overallScore: number;
  overallTarget: number;
  overallStatus: KpiStatus;
  message: string;
  totalCalls: number;
  closedTickets: number;
  workingHours: number;
  adherence: number;
}

export interface DashboardData {
  summary: AgentSummary;
  performance: KpiMetric[];
  adherence: KpiMetric[];
  experience: KpiMetric[];
  trend: TrendPoint[];
  insights: AgentInsight[];
  rowsProcessed: number;
  filesProcessed: number;
}

/** Lightweight agent record used for searching / listing. */
export interface AgentRecord {
  employeeId: string;
  name: string;
  role: string;
  overallScore: number;
  overallStatus: KpiStatus;
}

/** Full processed result containing every agent + an aggregate "All Agents" view. */
export interface ProcessedDataset {
  /** Aggregate dashboard across every agent (used when no search / no selection). */
  aggregate: DashboardData;
  /** Per-agent dashboards keyed by employeeId. */
  byAgent: Record<string, DashboardData>;
  /** Flat list for search / suggestions. */
  agents: AgentRecord[];
  rowsProcessed: number;
  filesProcessed: number;
}
