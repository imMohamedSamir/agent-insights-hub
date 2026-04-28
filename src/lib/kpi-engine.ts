import * as XLSX from "xlsx";
import type {
  AgentInsight,
  AgentRecord,
  AgentSummary,
  DashboardData,
  KpiMetric,
  KpiStatus,
  ProcessedDataset,
  TrendPoint,
} from "./kpi-types";

/**
 * Expected columns (case-insensitive, flexible aliases):
 * - Agent           (string)
 * - Date            (date / ISO string)
 * - Calls           (number)        total calls handled
 * - HandleTime      (number, sec)   handle time in seconds (per row aggregated)
 * - FCR             (number 0..1 or 0..100)  first-call-resolution rate
 * - QAScore         (number 0..100)
 * - AdherenceMin    (number)        minutes adhered to schedule
 * - ScheduledMin    (number)        minutes scheduled
 * - TNPS            (number 0..100)
 * - Rejected        (number)        rejected interactions
 * - Tickets         (number)        closed tickets
 */
const COLUMN_ALIASES: Record<string, string[]> = {
  agent: ["agent", "agent name", "name", "employee", "user", "employee name", "full name"],
  employeeId: [
    "employeeid",
    "employee id",
    "emp id",
    "empid",
    "id",
    "agent id",
    "user id",
    "staff id",
  ],
  date: ["date", "day", "shift date"],
  calls: ["calls", "total calls", "call volume", "callsHandled".toLowerCase()],
  handleTime: [
    "handletime",
    "handle time",
    "aht",
    "avg handle time",
    "average handle time",
    "talk time",
  ],
  fcr: ["fcr", "first call resolution", "first contact resolution"],
  qa: ["qa", "qascore", "qa score", "quality", "quality score"],
  adherenceMin: ["adherencemin", "adherence min", "adherence minutes", "adhered min"],
  scheduledMin: ["scheduledmin", "scheduled min", "scheduled minutes", "shift min"],
  tnps: ["tnps", "nps", "t-nps", "tNPS".toLowerCase()],
  rejected: ["rejected", "rejection", "rejections"],
  tickets: ["tickets", "closed tickets", "tickets closed", "resolved tickets"],
};

interface NormalizedRow {
  agent: string;
  employeeId: string;
  date: string; // ISO YYYY-MM-DD
  calls: number;
  handleTime: number; // seconds
  fcr: number; // 0..100
  qa: number; // 0..100
  adherenceMin: number;
  scheduledMin: number;
  tnps: number; // 0..100
  rejected: number;
  tickets: number;
}

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/\s+/g, " ").trim();
}

function findColumn(row: Record<string, unknown>, aliases: string[]): string | null {
  const keys = Object.keys(row);
  const normalized = keys.map((k) => ({ original: k, n: normalizeKey(k) }));
  for (const alias of aliases) {
    const hit = normalized.find((kk) => kk.n === alias);
    if (hit) return hit.original;
  }
  return null;
}

function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === "") return fallback;
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  const s = String(v).replace(/[, %$]/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function asPercent(v: unknown): number {
  const n = num(v, NaN);
  if (!Number.isFinite(n)) return 0;
  // if value looks like 0..1 ratio, convert to 0..100
  if (n > 0 && n <= 1) return n * 100;
  return n;
}

function parseDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + v * 86400000);
    return d.toISOString().slice(0, 10);
  }
  if (typeof v === "string") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

function normalizeRow(raw: Record<string, unknown>): NormalizedRow | null {
  const agentCol = findColumn(raw, COLUMN_ALIASES.agent);
  const dateCol = findColumn(raw, COLUMN_ALIASES.date);
  const idCol = findColumn(raw, COLUMN_ALIASES.employeeId);
  if (!agentCol && !dateCol && !idCol) return null;

  const agent = agentCol ? String(raw[agentCol] ?? "").trim() || "Unknown" : "Unknown";
  const employeeId = idCol
    ? String(raw[idCol] ?? "").trim()
    : "";

  return {
    agent,
    employeeId: employeeId || `AG-${agent.replace(/\s+/g, "").slice(0, 8).toUpperCase()}`,
    date: dateCol ? parseDate(raw[dateCol]) : new Date().toISOString().slice(0, 10),
    calls: num(raw[findColumn(raw, COLUMN_ALIASES.calls) ?? ""]),
    handleTime: num(raw[findColumn(raw, COLUMN_ALIASES.handleTime) ?? ""]),
    fcr: asPercent(raw[findColumn(raw, COLUMN_ALIASES.fcr) ?? ""]),
    qa: asPercent(raw[findColumn(raw, COLUMN_ALIASES.qa) ?? ""]),
    adherenceMin: num(raw[findColumn(raw, COLUMN_ALIASES.adherenceMin) ?? ""]),
    scheduledMin: num(raw[findColumn(raw, COLUMN_ALIASES.scheduledMin) ?? ""]),
    tnps: asPercent(raw[findColumn(raw, COLUMN_ALIASES.tnps) ?? ""]),
    rejected: num(raw[findColumn(raw, COLUMN_ALIASES.rejected) ?? ""]),
    tickets: num(raw[findColumn(raw, COLUMN_ALIASES.tickets) ?? ""]),
  };
}

export function parseWorkbookFromArrayBuffer(buf: ArrayBuffer): Record<string, unknown>[] {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const rows: Record<string, unknown>[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: true,
    });
    rows.push(...json);
  }
  return rows;
}

function statusFor(value: number, target: number, higherIsBetter: boolean): KpiStatus {
  const ratio = higherIsBetter ? value / target : target / value;
  if (!Number.isFinite(ratio)) return "off-target";
  if (ratio >= 1) return "on-target";
  if (ratio >= 0.9) return "near-target";
  return "off-target";
}

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function buildKpi(
  key: string,
  label: string,
  value: number,
  prevValue: number,
  target: number,
  higherIsBetter: boolean,
  formatter: (n: number) => string
): KpiMetric {
  const change = value - prevValue;
  const status = statusFor(value, target, higherIsBetter);
  const sign = change > 0 ? "+" : "";
  return {
    key,
    label,
    value,
    display: formatter(value),
    change,
    changeDisplay:
      key === "aht"
        ? `${sign}${Math.round(change)}s`
        : `${sign}${change.toFixed(1)}${formatter === formatPercent ? "%" : ""}`,
    target,
    targetDisplay: formatter(target),
    status,
    higherIsBetter,
  };
}

const formatPercent = (n: number) => `${Math.round(n * 10) / 10}%`;

export function computeDashboard(
  rawRows: Record<string, unknown>[],
  filesProcessed: number
): DashboardData {
  const rows = rawRows.map(normalizeRow).filter((r): r is NormalizedRow => r !== null);

  if (rows.length === 0) {
    throw new Error(
      "No usable rows found. Expected columns: Agent, Date, Calls, HandleTime, FCR, QAScore, AdherenceMin, ScheduledMin, TNPS, Rejected, Tickets."
    );
  }

  // Sort by date asc
  rows.sort((a, b) => a.date.localeCompare(b.date));

  // Group by date (treat as one agent's daily totals — if multiple agents present we average)
  const byDate = new Map<string, NormalizedRow[]>();
  for (const r of rows) {
    const arr = byDate.get(r.date) ?? [];
    arr.push(r);
    byDate.set(r.date, arr);
  }

  const dailyAggregates = Array.from(byDate.entries())
    .map(([date, group]) => {
      const sum = (k: keyof NormalizedRow) => group.reduce((a, r) => a + (r[k] as number), 0);
      const avg = (k: keyof NormalizedRow) => sum(k) / group.length;
      const totalCalls = sum("calls");
      const totalHandleSeconds = sum("handleTime") * (group[0].handleTime > 1000 ? 1 : 1);
      // weighted AHT in seconds per call
      const aht =
        totalCalls > 0
          ? totalHandleSeconds / totalCalls
          : group.length > 0
            ? avg("handleTime")
            : 0;
      return {
        date,
        calls: totalCalls,
        tickets: sum("tickets"),
        aht, // seconds per call (or per row if no per-call data)
        fcr: avg("fcr"),
        qa: avg("qa"),
        tnps: avg("tnps"),
        rejected: sum("rejected"),
        adherenceMin: sum("adherenceMin"),
        scheduledMin: sum("scheduledMin"),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Latest day = focus
  const latest = dailyAggregates[dailyAggregates.length - 1];
  const previous = dailyAggregates[dailyAggregates.length - 2] ?? latest;

  // Targets (sensible defaults)
  const targets = {
    aht: 200, // 3m 20s — represented in seconds
    fcr: 85,
    qa: 90,
    tnps: 90,
    rejection: 10, // lower-is-better, expressed as percent of calls
    adherence: 95,
    overall: 90,
  };

  const rejectionRate = (d: typeof latest) =>
    d.calls > 0 ? (d.rejected / d.calls) * 100 : d.rejected;

  const adherencePct = (d: typeof latest) =>
    d.scheduledMin > 0 ? (d.adherenceMin / d.scheduledMin) * 100 : 0;

  const performance: KpiMetric[] = [
    buildKpi("aht", "Avg Handle Time", latest.aht, previous.aht, targets.aht, false, formatSeconds),
    buildKpi("fcr", "First Call Resolution", latest.fcr, previous.fcr, targets.fcr, true, formatPercent),
    buildKpi("qa", "QA Quality Score", latest.qa, previous.qa, targets.qa, true, formatPercent),
    buildKpi("tnps", "TNPS", latest.tnps, previous.tnps, targets.tnps, true, formatPercent),
    buildKpi(
      "rejection",
      "Rejection",
      100 - rejectionRate(latest),
      100 - rejectionRate(previous),
      100 - targets.rejection,
      true,
      formatPercent
    ),
  ];

  const adherenceList: KpiMetric[] = [
    buildKpi(
      "adherence",
      "Schedule Adherence",
      adherencePct(latest),
      adherencePct(previous),
      targets.adherence,
      true,
      formatPercent
    ),
    buildKpi(
      "working-hours",
      "Working Hours",
      latest.adherenceMin / 60,
      previous.adherenceMin / 60,
      8,
      true,
      (n) => `${(Math.round(n * 10) / 10).toFixed(1)}h`
    ),
  ];

  const experience: KpiMetric[] = [
    buildKpi("tnps-x", "TNPS", latest.tnps, previous.tnps, targets.tnps, true, formatPercent),
    buildKpi("qa-x", "QA Score", latest.qa, previous.qa, targets.qa, true, formatPercent),
  ];

  // Overall score: weighted blend of normalised KPIs (each capped at 100)
  const norm = (m: KpiMetric) => {
    if (m.higherIsBetter) return Math.min(100, (m.value / m.target) * 100);
    return Math.min(100, (m.target / Math.max(m.value, 1)) * 100);
  };
  const overall = Math.round(
    (norm(performance[0]) * 0.2 +
      norm(performance[1]) * 0.25 +
      norm(performance[2]) * 0.25 +
      norm(performance[3]) * 0.15 +
      norm(performance[4]) * 0.15) *
      10
  ) / 10;

  const overallStatus = statusFor(overall, targets.overall, true);
  const message =
    overallStatus === "on-target"
      ? "Excellent work — you're hitting your targets!"
      : overallStatus === "near-target"
        ? "Keep going, you're almost at your daily goal!"
        : "Let's refocus on the priorities below to get back on track.";

  // Trend: last 7 days (pad if fewer)
  const dayLabels = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const last7 = dailyAggregates.slice(-7);
  const trend: TrendPoint[] = last7.map((d) => {
    const dayIdx = new Date(d.date).getUTCDay();
    const score = Math.round(
      ((d.fcr / targets.fcr) * 35 +
        (d.qa / targets.qa) * 35 +
        (d.tnps / targets.tnps) * 30) *
        10
    ) / 10;
    return {
      day: dayLabels[dayIdx],
      date: d.date,
      score: Math.min(100, Math.round(score * 10) / 10),
      target: targets.overall,
    };
  });

  // Insights
  const insights: AgentInsight[] = [];
  if (performance[0].status !== "on-target") {
    insights.push({
      type: "alert",
      title: "AHT Threshold Alert",
      body: `Your AHT is ${performance[0].display} vs target ${performance[0].targetDisplay}. Focus on closing simpler queries faster.`,
    });
  }
  const ticketsToTarget = Math.max(0, Math.round(latest.calls * 0.1) - latest.tickets);
  insights.push({
    type: "goal",
    title: "Goal Proximity",
    body:
      ticketsToTarget > 0
        ? `You need ${ticketsToTarget} more closed tickets to hit your daily target. You're on pace for a record week!`
        : `You've hit your closed-ticket target — keep the momentum going!`,
  });
  insights.push({
    type: "tip",
    title: "Quality Tip",
    body: "Confirming the customer's intent at the start of the call has shown a 12% boost in FCR for your peers.",
  });

  // Agent summary
  const agentNames = Array.from(new Set(rows.map((r) => r.agent)));
  const employeeIds = Array.from(new Set(rows.map((r) => r.employeeId)));
  const isAggregate = agentNames.length > 1;
  const summary: AgentSummary = {
    name: isAggregate ? `All Agents (${agentNames.length})` : (agentNames[0] ?? "Aley Rivera"),
    employeeId: isAggregate ? "ALL" : (employeeIds[0] ?? "—"),
    role: "TIER 2 SUPPORT",
    date: latest.date,
    overallScore: overall,
    overallTarget: targets.overall,
    overallStatus,
    message,
    totalCalls: latest.calls,
    closedTickets: latest.tickets,
    workingHours: Math.round((latest.adherenceMin / 60) * 10) / 10,
    adherence: Math.round(adherencePct(latest) * 10) / 10,
  };

  return {
    summary,
    performance,
    adherence: adherenceList,
    experience,
    trend,
    insights,
    rowsProcessed: rows.length,
    filesProcessed,
  };
}

/**
 * Process raw rows into a full dataset: aggregate dashboard + per-agent dashboards
 * + a flat list of agents (for searching).
 */
export function processWorkbookRows(
  rawRows: Record<string, unknown>[],
  filesProcessed: number
): ProcessedDataset {
  const rows = rawRows.map(normalizeRow).filter((r): r is NormalizedRow => r !== null);
  if (rows.length === 0) {
    throw new Error(
      "No usable rows found. Expected columns: Agent, EmployeeId, Date, Calls, HandleTime, FCR, QAScore, AdherenceMin, ScheduledMin, TNPS, Rejected, Tickets."
    );
  }

  const aggregate = computeDashboard(rawRows, filesProcessed);

  // Group raw rows back by employeeId so per-agent dashboards reuse the same logic.
  const groups = new Map<string, { name: string; rows: Record<string, unknown>[] }>();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const raw = rawRows[i];
    const g = groups.get(r.employeeId) ?? { name: r.agent, rows: [] };
    g.rows.push(raw);
    groups.set(r.employeeId, g);
  }

  const byAgent: Record<string, DashboardData> = {};
  const agents: AgentRecord[] = [];
  for (const [employeeId, g] of groups) {
    const dash = computeDashboard(g.rows, filesProcessed);
    // Force the per-agent summary identity (computeDashboard infers from rows;
    // safe to override with the canonical id/name we grouped by).
    dash.summary.employeeId = employeeId;
    dash.summary.name = g.name;
    byAgent[employeeId] = dash;
    agents.push({
      employeeId,
      name: g.name,
      role: dash.summary.role,
      overallScore: dash.summary.overallScore,
      overallStatus: dash.summary.overallStatus,
    });
  }

  agents.sort((a, b) => a.name.localeCompare(b.name));

  return {
    aggregate,
    byAgent,
    agents,
    rowsProcessed: rows.length,
    filesProcessed,
  };
}

export function buildSampleDashboard(): DashboardData {
  // Build a synthetic 7-day dataset matching the mockup
  const today = new Date();
  const rows: Record<string, unknown>[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateIso = d.toISOString().slice(0, 10);
    const calls = 38 + Math.round(Math.sin(i) * 6) + 7;
    rows.push({
      Agent: "Aley Rivera",
      Date: dateIso,
      Calls: calls,
      HandleTime: 200 * calls + i * 120, // total seconds across calls
      FCR: 86 + (i % 3),
      QAScore: 91 + (i % 3),
      AdherenceMin: 380 + i * 4,
      ScheduledMin: 420,
      TNPS: 90 + (i % 4),
      Rejected: Math.max(0, 4 - (i % 3)),
      Tickets: 10 + (i % 4),
    });
  }
  return computeDashboard(rows, 1);
}
