import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AgentRecord, DashboardData, ProcessedDataset } from "@/lib/kpi-types";
import {
  buildSampleDataset,
  parseWorkbookFromArrayBuffer,
  processWorkbookRows,
} from "@/lib/kpi-engine";
import embeddedXlsxUrl from "@/assets/embedded-data.xlsx?url";

interface Ctx {
  /** Underlying processed dataset (aggregate + per-agent + agent list). */
  dataset: ProcessedDataset;
  /** Currently displayed dashboard (filtered by search/selection or aggregate). */
  data: DashboardData;
  /** All agents in the dataset. */
  agents: AgentRecord[];
  /** Agents matching the current search term. */
  filteredAgents: AgentRecord[];
  /** Selected agent (when a single agent's dashboard is displayed). */
  selectedAgent: AgentRecord | null;
  /** Live search term. */
  searchTerm: string;
  /** Debounced search term used for filtering. */
  debouncedSearchTerm: string;
  setSearchTerm: (s: string) => void;
  selectAgent: (employeeId: string | null) => void;
  isSample: boolean;
  setDataset: (d: ProcessedDataset) => void;
  reset: () => void;
}

const DashboardContext = createContext<Ctx | null>(null);

function matchesAgent(a: AgentRecord, term: string): boolean {
  if (!term) return true;
  const t = term.toLowerCase().trim();
  return (
    a.name.toLowerCase().includes(t) ||
    a.employeeId.toLowerCase().includes(t)
  );
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [dataset, setDatasetState] = useState<ProcessedDataset>(() => buildSampleDataset());
  const [isSample, setIsSample] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Debounce search term (300ms)
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(id);
  }, [searchTerm]);

  // Auto-load embedded Excel data on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(embeddedXlsxUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        const rows = parseWorkbookFromArrayBuffer(buf);
        const result = processWorkbookRows(rows, 1);
        if (cancelled) return;
        setDatasetState(result);
        setIsSample(false);
      } catch (err) {
        console.error("Failed to load embedded dataset:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredAgents = useMemo(
    () => dataset.agents.filter((a) => matchesAgent(a, debouncedSearchTerm)),
    [dataset.agents, debouncedSearchTerm]
  );

  // Auto-resolve selection: if exactly one match, show that agent.
  const selectedAgent = useMemo<AgentRecord | null>(() => {
    if (selectedId) {
      return dataset.agents.find((a) => a.employeeId === selectedId) ?? null;
    }
    if (debouncedSearchTerm.trim() && filteredAgents.length === 1) {
      return filteredAgents[0];
    }
    return null;
  }, [selectedId, debouncedSearchTerm, filteredAgents, dataset.agents]);

  const data: DashboardData = useMemo(() => {
    if (selectedAgent && dataset.byAgent[selectedAgent.employeeId]) {
      return dataset.byAgent[selectedAgent.employeeId];
    }
    return dataset.aggregate;
  }, [selectedAgent, dataset]);

  const setDataset = useCallback((d: ProcessedDataset) => {
    setDatasetState(d);
    setIsSample(false);
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setSelectedId(null);
  }, []);

  const reset = useCallback(() => {
    setDatasetState(buildSampleDataset());
    setIsSample(true);
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setSelectedId(null);
  }, []);

  const selectAgent = useCallback((employeeId: string | null) => {
    setSelectedId(employeeId);
  }, []);

  return (
    <DashboardContext.Provider
      value={{
        dataset,
        data,
        agents: dataset.agents,
        filteredAgents,
        selectedAgent,
        searchTerm,
        debouncedSearchTerm,
        setSearchTerm,
        selectAgent,
        isSample,
        setDataset,
        reset,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): Ctx {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
