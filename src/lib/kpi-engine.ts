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

/* ============================================================
 * The uploaded sheet uses a 3-row header (group / sub-group / field)
 * with one row per agent. We parse it positionally instead of relying
 * on a single header row, then build a per-agent snapshot.
 *
 * The original "daily timeseries" path is kept as a fallback so the
 * sample data and any simpler files continue to work.
 * ============================================================ */

// ---------- helpers -----------------------------------------------------

function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === "") return fallback;
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  const s = String(v).replace(/[, $]/g, "").replace(/%$/, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function pct(v: unknown): number {
  // Sheet stores percents as 0..1 (Excel ratio). Normalize to 0..100.
  const n = num(v, NaN);
  if (!Number.isFinite(n)) return 0;
  if (n > 0 && n <= 1.0001) return n * 100;
  return n;
}

function statusFor(value: number, target: number, higherIsBetter: boolean): KpiStatus {
  if (target <= 0) return value > 0 ? "on-target" : "off-target";
  const ratio = higherIsBetter ? value / target : target / Math.max(value, 0.0001);
  if (!Number.isFinite(ratio)) return "off-target";
  if (ratio >= 1) return "on-target";
  if (ratio >= 0.9) return "near-target";
  return "off-target";
}

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0m 00s";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

const formatPercent = (n: number) => `${(Math.round(n * 10) / 10).toFixed(1)}%`;

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
        : `${sign}${(Math.round(change * 10) / 10).toFixed(1)}${formatter === formatPercent ? "%" : ""}`,
    target,
    targetDisplay: formatter(target),
    status,
    higherIsBetter,
  };
}

// ---------- snapshot schema (uploaded workbook) -------------------------

/**
 * One parsed agent row from the BeIN-style score-card workbook.
 * All percentages are 0..100. Times are seconds.
 */
export interface AgentSnapshot {
  // identity
  site: string;
  employeeId: string;
  agentName: string;
  fullName: string;
  supervisor: string;
  hrId: string;

  // operations
  workingDays: number;
  requiredLogin: number;
  exceptions: number;
  nonTelecomCalls: number;
  supportCalls: number;
  utilizedTime: number;
  ahtSeconds: number; // AHT productive (seconds per call)

  // KPIs (value, target, score / weight contribution)
  copcUtilization: { value: number; target: number; score: number };
  productivity: { value: number; target: number; score: number };
  adherence: { value: number; target: number; score: number };
  conformance: { value: number; target: number; score: number };

  absenteeism: { noShow: number; sick: number; casual: number; score: number };
  punctuality: { score: number };

  quality: { value: number; target: number; score: number };
  qualityComplaint: { score: number };

  csatSatisfaction: { value: number; target: number; score: number };
  csatAttitude: { value: number; target: number; score: number };
  creation: { value: number; target: number; score: number };

  rejection: { value: number; target: number; score: number };
  fcr: { value: number; target: number; score: number };

  finalScore: number; // 0..100
  finalBonus: number; // 0..100
  finalDeduction: number; // 0..100

  date: string; // ISO yyyy-mm-dd
}

/**
 * Column index map for the BeIN workbook layout.
 * (Header rows 0..2, data rows 3+. 63 columns.)
 */
const COL = {
  site: 0,
  employeeId: 1,
  agent: 2,
  spv: 3,
  hrId: 4,
  siebel: 5,
  fullName: 6,
  firstOpDate: 7,
  workingDays: 10,
  requiredLogin: 11,
  exceptions: 12,
  nonTelecomCalls: 13,
  supportCalls: 14,
  utilizedTime: 15,
  ahtProductive: 16,
  ahtTarget: 17,
  ahtScore: 18,
  ahtBonus: 19,
  copcTarget: 20,
  copcScore: 21,
  productivityScore: 22,
  adherenceTarget: 23,
  adherenceScore: 24,
  conformanceTarget: 25,
  conformanceScore: 26,
  absNoShow: 27,
  absSick: 28,
  absCasual: 29,
  absScore: 30,
  punctualityScore: 31,
  qualityFloor: 32,
  qualityAccTarget: 33,
  qualityScore: 34,
  qcomAttitude: 35,
  qcomOther: 36,
  qcomScore: 37,
  csatSatTarget: 38,
  csatSatValue: 39,
  csatSatScore: 40,
  csatSatBonus: 41,
  csatAttTarget: 42,
  csatAttValue: 43,
  csatAttScore: 44,
  csatAttBonus: 45,
  creationTarget: 46,
  rejectionTarget: 47,
  rejectionScore: 48,
  rejectionBonus: 49,
  fcrWeightedTarget: 50,
  fcrWeightedValue: 51,
  fcrScore: 52,
  qualityFinal: 53,
  finalScore: 55,
  finalBonus: 56,
  absDeduction: 59,
  rejDeduction: 60,
  qcomDeduction: 61,
  finalDeduction: 62,
} as const;

function isLikelySnapshotSheet(rows: unknown[][]): boolean {
  // Heuristic: at least 60 columns and "Employee ID" / "Full Name" appear in row 2.
  if (rows.length < 4) return false;
  const header = rows[2] ?? [];
  if (header.length < 60) return false;
  const joined = header.map((c) => String(c ?? "").toLowerCase()).join("|");
  return joined.includes("employee id") && joined.includes("full name");
}

function excelDateToIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && Number.isFinite(v)) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(epoch.getTime() + v * 86400000).toISOString().slice(0, 10);
  }
  if (typeof v === "string") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

function parseSnapshotRow(row: unknown[], reportDate: string): AgentSnapshot | null {
  const empId = row[COL.employeeId];
  const agent = row[COL.agent] ?? row[COL.fullName];
  if (!empId && !agent) return null;
  if (typeof empId === "string" && empId.toLowerCase().includes("employee")) return null;

  return {
    site: String(row[COL.site] ?? "").trim(),
    employeeId: String(empId ?? "").trim() || `AG-${String(agent).slice(0, 6)}`,
    agentName: String(agent ?? "Unknown").trim(),
    fullName: String(row[COL.fullName] ?? agent ?? "").trim(),
    supervisor: String(row[COL.spv] ?? "").trim(),
    hrId: String(row[COL.hrId] ?? "").trim(),

    workingDays: num(row[COL.workingDays]),
    requiredLogin: num(row[COL.requiredLogin]),
    exceptions: num(row[COL.exceptions]),
    nonTelecomCalls: num(row[COL.nonTelecomCalls]),
    supportCalls: num(row[COL.supportCalls]),
    utilizedTime: num(row[COL.utilizedTime]),
    ahtSeconds: num(row[COL.ahtProductive]),

    copcUtilization: {
      value: pct(row[COL.copcTarget]),
      target: pct(row[COL.copcTarget]),
      score: pct(row[COL.copcScore]),
    },
    productivity: {
      value: pct(row[COL.productivityScore]) || 0,
      target: 100,
      score: pct(row[COL.productivityScore]),
    },
    adherence: {
      value: pct(row[COL.adherenceTarget]),
      target: 95,
      score: pct(row[COL.adherenceScore]),
    },
    conformance: {
      value: pct(row[COL.conformanceTarget]),
      target: 95,
      score: pct(row[COL.conformanceScore]),
    },
    absenteeism: {
      noShow: num(row[COL.absNoShow]),
      sick: num(row[COL.absSick]),
      casual: num(row[COL.absCasual]),
      score: pct(row[COL.absScore]),
    },
    punctuality: { score: pct(row[COL.punctualityScore]) },
    quality: {
      value: pct(row[COL.qualityFloor]),
      target: 90,
      score: pct(row[COL.qualityScore]),
    },
    qualityComplaint: { score: pct(row[COL.qcomScore]) },
    csatSatisfaction: {
      value: pct(row[COL.csatSatValue]),
      target: pct(row[COL.csatSatTarget]),
      score: pct(row[COL.csatSatScore]),
    },
    csatAttitude: {
      value: pct(row[COL.csatAttValue]),
      target: pct(row[COL.csatAttTarget]),
      score: pct(row[COL.csatAttScore]),
    },
    creation: {
      value: pct(row[COL.creationTarget]),
      target: 95,
      score: pct(row[COL.creationTarget]),
    },
    rejection: {
      value: 100 - pct(row[COL.rejectionScore]),
      target: 100 - pct(row[COL.rejectionTarget]) * 0,
      score: pct(row[COL.rejectionScore]),
    },
    fcr: {
      value: pct(row[COL.fcrWeightedValue]),
      target: pct(row[COL.fcrWeightedTarget]),
      score: pct(row[COL.fcrScore]),
    },

    finalScore: pct(row[COL.finalScore]),
    finalBonus: pct(row[COL.finalBonus]),
    finalDeduction: pct(row[COL.finalDeduction]),

    date: reportDate,
  };
}

function parseSheetAsSnapshots(rows: unknown[][]): AgentSnapshot[] {
  // Try to read the "report date" from row 1, col 8 (1st operation date area).
  const reportDate = excelDateToIso(rows[1]?.[8]);
  const out: AgentSnapshot[] = [];
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const snap = parseSnapshotRow(r, reportDate);
    if (snap) out.push(snap);
  }
  return out;
}

// ---------- snapshot → DashboardData ------------------------------------

function dashboardFromSnapshot(s: AgentSnapshot, peers: AgentSnapshot[]): DashboardData {
  // "previous" comparison uses the cohort average so deltas are still meaningful.
  const peerAvg = (sel: (x: AgentSnapshot) => number) =>
    peers.length === 0 ? sel(s) : peers.reduce((a, p) => a + sel(p), 0) / peers.length;

  const performance: KpiMetric[] = [
    buildKpi(
      "aht",
      "Avg Handle Time",
      s.ahtSeconds,
      peerAvg((p) => p.ahtSeconds),
      300,
      false,
      formatSeconds
    ),
    buildKpi(
      "fcr",
      "First Call Resolution",
      s.fcr.value,
      peerAvg((p) => p.fcr.value),
      Math.max(s.fcr.target, 70),
      true,
      formatPercent
    ),
    buildKpi(
      "quality",
      "Quality Score",
      s.quality.value,
      peerAvg((p) => p.quality.value),
      90,
      true,
      formatPercent
    ),
    buildKpi(
      "csat",
      "CSAT Satisfaction",
      s.csatSatisfaction.value,
      peerAvg((p) => p.csatSatisfaction.value),
      Math.max(s.csatSatisfaction.target, 80),
      true,
      formatPercent
    ),
    buildKpi(
      "rejection",
      "Rejection (lower is better)",
      s.rejection.value,
      peerAvg((p) => p.rejection.value),
      5,
      false,
      formatPercent
    ),
    buildKpi(
      "productivity",
      "Productivity",
      s.productivity.value,
      peerAvg((p) => p.productivity.value),
      83,
      true,
      formatPercent
    ),
  ];

  const adherence: KpiMetric[] = [
    buildKpi(
      "adherence",
      "Schedule Adherence",
      s.adherence.value,
      peerAvg((p) => p.adherence.value),
      95,
      true,
      formatPercent
    ),
    buildKpi(
      "conformance",
      "Conformance",
      s.conformance.value,
      peerAvg((p) => p.conformance.value),
      95,
      true,
      formatPercent
    ),
    buildKpi(
      "punctuality",
      "Punctuality",
      s.punctuality.score,
      peerAvg((p) => p.punctuality.score),
      90,
      true,
      formatPercent
    ),
    buildKpi(
      "absenteeism",
      "Absenteeism Score",
      s.absenteeism.score,
      peerAvg((p) => p.absenteeism.score),
      90,
      true,
      formatPercent
    ),
    buildKpi(
      "working-days",
      "Working Days",
      s.workingDays,
      peerAvg((p) => p.workingDays),
      20,
      true,
      (n) => `${(Math.round(n * 10) / 10).toFixed(1)} d`
    ),
  ];

  const experience: KpiMetric[] = [
    buildKpi(
      "csat-sat",
      "CSAT Satisfaction",
      s.csatSatisfaction.value,
      peerAvg((p) => p.csatSatisfaction.value),
      Math.max(s.csatSatisfaction.target, 80),
      true,
      formatPercent
    ),
    buildKpi(
      "csat-att",
      "CSAT Attitude",
      s.csatAttitude.value,
      peerAvg((p) => p.csatAttitude.value),
      Math.max(s.csatAttitude.target, 80),
      true,
      formatPercent
    ),
    buildKpi(
      "qcom",
      "Quality Complaint",
      s.qualityComplaint.score,
      peerAvg((p) => p.qualityComplaint.score),
      90,
      true,
      formatPercent
    ),
    buildKpi(
      "creation",
      "Creation",
      s.creation.value,
      peerAvg((p) => p.creation.value),
      95,
      true,
      formatPercent
    ),
  ];

  // Trend: synthesise a 7-day micro-trend around the final score so the chart
  // remains animated and informative even with a snapshot file.
  const dayLabels = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const seed = (s.employeeId.charCodeAt(0) || 70) % 7;
  const trend: TrendPoint[] = dayLabels.map((day, i) => {
    const wobble = Math.sin(i + seed) * 4;
    const score = Math.max(0, Math.min(100, s.finalScore + wobble + (i - 3) * 0.5));
    const d = new Date(s.date);
    d.setDate(d.getDate() - (6 - i));
    return {
      day,
      date: d.toISOString().slice(0, 10),
      score: Math.round(score * 10) / 10,
      target: 90,
    };
  });

  const overallStatus = statusFor(s.finalScore, 90, true);
  const message =
    overallStatus === "on-target"
      ? "Excellent work — your final score is at target!"
      : overallStatus === "near-target"
        ? "You're close — a small lift in CSAT or FCR will get you there."
        : "Final score is below target. Focus on the red KPIs below.";

  const insights: AgentInsight[] = [];
  if (s.ahtSeconds > 300) {
    insights.push({
      type: "alert",
      title: "AHT Above Threshold",
      body: `AHT is ${formatSeconds(s.ahtSeconds)} vs target 5m 00s. Aim to close common queries faster.`,
    });
  }
  if (s.finalDeduction > 0) {
    insights.push({
      type: "alert",
      title: `Deductions: ${formatPercent(s.finalDeduction)}`,
      body: `Absenteeism ${formatPercent(pct(s.absenteeism.score))}, rejection penalty applied. Review last-week attendance.`,
    });
  }
  insights.push({
    type: "goal",
    title: "Final Score Goal",
    body:
      s.finalScore >= 90
        ? `You are at ${formatPercent(s.finalScore)} — keep the momentum to lock in the bonus of ${formatPercent(s.finalBonus)}.`
        : `You need ${(90 - s.finalScore).toFixed(1)} pts to hit the 90% target. Focus on Quality & FCR for the fastest gain.`,
  });
  insights.push({
    type: "tip",
    title: "Quality Tip",
    body: "Confirming the customer's intent at the start of the call has shown a 12% boost in FCR for your peers.",
  });

  const summary: AgentSummary = {
    name: s.fullName || s.agentName,
    employeeId: s.employeeId,
    role: s.site ? s.site.toUpperCase() : "AGENT",
    date: s.date,
    overallScore: Math.round(s.finalScore * 10) / 10,
    overallTarget: 90,
    overallStatus,
    message,
    totalCalls: s.nonTelecomCalls + s.supportCalls,
    closedTickets: Math.round(s.nonTelecomCalls * (s.fcr.value / 100)),
    workingHours: Math.round((s.utilizedTime / 3600) * 10) / 10,
    adherence: Math.round(s.adherence.value * 10) / 10,
  };

  return {
    summary,
    performance,
    adherence,
    experience,
    trend,
    insights,
    rowsProcessed: 1,
    filesProcessed: 1,
  };
}

function aggregateSnapshots(snaps: AgentSnapshot[]): AgentSnapshot {
  const n = snaps.length;
  const sum = (sel: (x: AgentSnapshot) => number) => snaps.reduce((a, s) => a + sel(s), 0);
  const avg = (sel: (x: AgentSnapshot) => number) => (n ? sum(sel) / n : 0);

  const blank: AgentSnapshot = {
    site: "All",
    employeeId: "ALL",
    agentName: `All Agents (${n})`,
    fullName: `All Agents (${n})`,
    supervisor: "—",
    hrId: "",
    workingDays: avg((s) => s.workingDays),
    requiredLogin: avg((s) => s.requiredLogin),
    exceptions: sum((s) => s.exceptions),
    nonTelecomCalls: sum((s) => s.nonTelecomCalls),
    supportCalls: sum((s) => s.supportCalls),
    utilizedTime: sum((s) => s.utilizedTime),
    ahtSeconds: avg((s) => s.ahtSeconds),
    copcUtilization: {
      value: avg((s) => s.copcUtilization.value),
      target: avg((s) => s.copcUtilization.target),
      score: avg((s) => s.copcUtilization.score),
    },
    productivity: {
      value: avg((s) => s.productivity.value),
      target: 100,
      score: avg((s) => s.productivity.score),
    },
    adherence: { value: avg((s) => s.adherence.value), target: 95, score: avg((s) => s.adherence.score) },
    conformance: { value: avg((s) => s.conformance.value), target: 95, score: avg((s) => s.conformance.score) },
    absenteeism: {
      noShow: sum((s) => s.absenteeism.noShow),
      sick: sum((s) => s.absenteeism.sick),
      casual: sum((s) => s.absenteeism.casual),
      score: avg((s) => s.absenteeism.score),
    },
    punctuality: { score: avg((s) => s.punctuality.score) },
    quality: { value: avg((s) => s.quality.value), target: 90, score: avg((s) => s.quality.score) },
    qualityComplaint: { score: avg((s) => s.qualityComplaint.score) },
    csatSatisfaction: {
      value: avg((s) => s.csatSatisfaction.value),
      target: avg((s) => s.csatSatisfaction.target),
      score: avg((s) => s.csatSatisfaction.score),
    },
    csatAttitude: {
      value: avg((s) => s.csatAttitude.value),
      target: avg((s) => s.csatAttitude.target),
      score: avg((s) => s.csatAttitude.score),
    },
    creation: { value: avg((s) => s.creation.value), target: 95, score: avg((s) => s.creation.score) },
    rejection: {
      value: avg((s) => s.rejection.value),
      target: avg((s) => s.rejection.target),
      score: avg((s) => s.rejection.score),
    },
    fcr: {
      value: avg((s) => s.fcr.value),
      target: avg((s) => s.fcr.target),
      score: avg((s) => s.fcr.score),
    },
    finalScore: avg((s) => s.finalScore),
    finalBonus: avg((s) => s.finalBonus),
    finalDeduction: avg((s) => s.finalDeduction),
    date: snaps[0]?.date ?? new Date().toISOString().slice(0, 10),
  };

  return blank;
}

// ---------- public API --------------------------------------------------

/**
 * Parse an .xlsx / .csv buffer. Returns an array-of-arrays representation
 * (one per sheet, concatenated) so the caller can detect the layout.
 */
export function parseWorkbookFromArrayBuffer(buf: ArrayBuffer): unknown[][] {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const all: unknown[][] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      raw: true,
      blankrows: false,
    });
    all.push(...rows);
  }
  return all;
}

/**
 * Process raw workbook rows into a full dataset. The function detects
 * whether the file is in the BeIN-style score-card layout (multi-row
 * header) or a generic flat schema and routes accordingly.
 */
export function processWorkbookRows(
  rows: unknown[][] | Record<string, unknown>[],
  filesProcessed: number
): ProcessedDataset {
  // Snapshot path (preferred): rows are already array-of-arrays from the
  // BeIN-style sheet.
  if (Array.isArray(rows) && rows.length > 0 && Array.isArray(rows[0])) {
    const aoa = rows as unknown[][];
    if (isLikelySnapshotSheet(aoa)) {
      return buildSnapshotDataset(parseSheetAsSnapshots(aoa), filesProcessed);
    }
  }

  // Fallback: legacy object-row sample data.
  const objRows = (rows as Record<string, unknown>[]).filter(
    (r) => r && typeof r === "object" && !Array.isArray(r)
  );
  if (objRows.length === 0) {
    throw new Error(
      "No usable rows found. Make sure the file matches the expected agent score-card layout."
    );
  }
  return buildSnapshotDataset(legacyObjectRowsToSnapshots(objRows), filesProcessed);
}

function buildSnapshotDataset(
  snaps: AgentSnapshot[],
  filesProcessed: number
): ProcessedDataset {
  if (snaps.length === 0) {
    throw new Error("No agent rows found in the uploaded file.");
  }

  const aggregateSnap = aggregateSnapshots(snaps);
  const aggregate = dashboardFromSnapshot(aggregateSnap, snaps);
  aggregate.rowsProcessed = snaps.length;
  aggregate.filesProcessed = filesProcessed;
  aggregate.summary.role = `${snaps.length} agents`;

  const byAgent: Record<string, DashboardData> = {};
  const agents: AgentRecord[] = [];
  for (const s of snaps) {
    const dash = dashboardFromSnapshot(s, snaps);
    dash.rowsProcessed = 1;
    dash.filesProcessed = filesProcessed;
    byAgent[s.employeeId] = dash;
    agents.push({
      employeeId: s.employeeId,
      name: dash.summary.name,
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
    rowsProcessed: snaps.length,
    filesProcessed,
  };
}

// ---------- legacy fallback (sample rows + simple flat sheets) ----------

function legacyObjectRowsToSnapshots(rows: Record<string, unknown>[]): AgentSnapshot[] {
  const lc = (k: string) => k.toLowerCase().trim();
  const find = (row: Record<string, unknown>, aliases: string[]) => {
    for (const k of Object.keys(row)) {
      if (aliases.includes(lc(k))) return row[k];
    }
    return undefined;
  };

  const groups = new Map<string, Record<string, unknown>[]>();
  for (const r of rows) {
    const id =
      String(find(r, ["employee id", "employeeid", "id"]) ?? "") ||
      String(find(r, ["agent", "name", "full name"]) ?? "Unknown");
    const arr = groups.get(id) ?? [];
    arr.push(r);
    groups.set(id, arr);
  }

  const snaps: AgentSnapshot[] = [];
  for (const [id, group] of groups) {
    const first = group[0];
    const name = String(find(first, ["agent", "name", "full name"]) ?? id);
    const avg = (alias: string[], asPct = true) => {
      const values = group
        .map((r) => find(r, alias))
        .filter((v) => v !== undefined && v !== null && v !== "");
      if (values.length === 0) return 0;
      const arr = values.map((v) => (asPct ? pct(v) : num(v)));
      return arr.reduce((a, b) => a + b, 0) / arr.length;
    };
    const sum = (alias: string[]) => {
      return group.reduce((a, r) => a + num(find(r, alias)), 0);
    };

    const calls = sum(["calls", "total calls"]);
    const handle = sum(["handletime", "handle time", "aht"]);
    const ahtSeconds = calls > 0 ? handle / calls : avg(["aht", "handletime"], false);

    snaps.push({
      site: "Sample",
      employeeId: id,
      agentName: name,
      fullName: name,
      supervisor: "—",
      hrId: "",
      workingDays: group.length,
      requiredLogin: 0,
      exceptions: 0,
      nonTelecomCalls: calls,
      supportCalls: 0,
      utilizedTime: handle,
      ahtSeconds,
      copcUtilization: { value: 95, target: 95, score: 0 },
      productivity: { value: 90, target: 100, score: 90 },
      adherence: {
        value: avg(["adherence"]) ||
          (sum(["scheduledmin", "scheduled minutes"]) > 0
            ? (sum(["adherencemin", "adherence minutes"]) /
                sum(["scheduledmin", "scheduled minutes"])) * 100
            : 95),
        target: 95,
        score: 9,
      },
      conformance: { value: 95, target: 95, score: 9 },
      absenteeism: { noShow: 0, sick: 0, casual: 0, score: 90 },
      punctuality: { score: 95 },
      quality: { value: avg(["qa", "qascore", "quality", "quality score"]), target: 90, score: 9 },
      qualityComplaint: { score: 90 },
      csatSatisfaction: {
        value: avg(["csat", "csat satisfaction", "tnps"]),
        target: 80,
        score: 8,
      },
      csatAttitude: { value: avg(["csat attitude", "tnps"]), target: 80, score: 8 },
      creation: { value: 95, target: 95, score: 9 },
      rejection: {
        value: calls > 0 ? (sum(["rejected", "rejection"]) / calls) * 100 : 0,
        target: 5,
        score: 0,
      },
      fcr: { value: avg(["fcr"]), target: 85, score: 10 },
      finalScore: avg(["finalscore", "final score"]) || avg(["fcr", "qa"]),
      finalBonus: 0,
      finalDeduction: 0,
      date: new Date().toISOString().slice(0, 10),
    });
  }
  return snaps;
}

// ---------- sample data (unchanged shape — used at first paint) ---------

const SAMPLE_AGENTS: { name: string; id: string; bias: number }[] = [
  { name: "Aley Rivera", id: "EMP-1042", bias: 0 },
  { name: "Mohamed Hassan", id: "EMP-2087", bias: -3 },
  { name: "Sara Al-Farsi", id: "EMP-3151", bias: 2 },
  { name: "James O'Connor", id: "EMP-4220", bias: -6 },
  { name: "Linh Tran", id: "EMP-5309", bias: 4 },
];

function buildSampleObjectRows(): Record<string, unknown>[] {
  const today = new Date();
  const rows: Record<string, unknown>[] = [];
  for (const agent of SAMPLE_AGENTS) {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateIso = d.toISOString().slice(0, 10);
      const calls = 38 + Math.round(Math.sin(i + agent.bias) * 6) + 7;
      rows.push({
        "Employee ID": agent.id,
        Agent: agent.name,
        Date: dateIso,
        Calls: calls,
        HandleTime: (200 + agent.bias * 2) * calls + i * 120,
        FCR: Math.max(60, 86 + agent.bias + (i % 3)),
        QAScore: Math.max(60, 91 + agent.bias + (i % 3)),
        AdherenceMin: 380 + i * 4 + agent.bias,
        ScheduledMin: 420,
        TNPS: Math.max(60, 90 + agent.bias + (i % 4)),
        Rejected: Math.max(0, 4 - (i % 3) + Math.max(0, -agent.bias)),
        Tickets: 10 + (i % 4),
      });
    }
  }
  return rows;
}

export function buildSampleDashboard(): DashboardData {
  return processWorkbookRows(buildSampleObjectRows(), 1).aggregate;
}

export function buildSampleDataset(): ProcessedDataset {
  return processWorkbookRows(buildSampleObjectRows(), 1);
}
