import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X, UserSearch } from "lucide-react";
import { useDashboard } from "@/state/dashboard-context";
import type { AgentRecord } from "@/lib/kpi-types";

function highlight(text: string, term: string) {
  if (!term) return text;
  const t = term.trim();
  if (!t) return text;
  const idx = text.toLowerCase().indexOf(t.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary-soft text-primary px-0.5 rounded-sm">
        {text.slice(idx, idx + t.length)}
      </mark>
      {text.slice(idx + t.length)}
    </>
  );
}

const STATUS_DOT: Record<AgentRecord["overallStatus"], string> = {
  "on-target": "bg-success",
  "near-target": "bg-warning",
  "off-target": "bg-primary",
};

export function SearchBar() {
  const {
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm,
    filteredAgents,
    selectAgent,
    selectedAgent,
  } = useDashboard();

  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasTerm = debouncedSearchTerm.trim().length > 0;
  const suggestions = filteredAgents.slice(0, 5);
  const showEmpty = hasTerm && filteredAgents.length === 0;

  useEffect(() => {
    setActiveIdx(0);
  }, [debouncedSearchTerm]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleSelect = (a: AgentRecord) => {
    selectAgent(a.employeeId);
    setSearchTerm(a.name);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setSearchTerm("");
    selectAgent(null);
    setOpen(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions[activeIdx]) handleSelect(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={wrapRef} className="relative w-full max-w-md">
      <motion.div
        initial={false}
        animate={{
          boxShadow: open
            ? "0 0 0 3px color-mix(in oklab, var(--primary) 20%, transparent)"
            : "0 1px 2px rgba(15,23,42,0.04)",
        }}
        transition={{ duration: 0.18 }}
        className="flex items-center gap-2 rounded-full bg-card border border-border pl-4 pr-2 h-10"
      >
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setOpen(true);
            if (selectedAgent) selectAgent(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search by Agent Name or Employee ID..."
          className="flex-1 min-w-0 bg-transparent text-sm placeholder:text-muted-foreground/70 outline-none"
          aria-label="Search agents"
          autoComplete="off"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="h-7 w-7 grid place-items-center rounded-full text-muted-foreground hover:bg-primary-soft hover:text-primary transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </motion.div>

      <AnimatePresence>
        {open && (hasTerm || suggestions.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="absolute left-0 right-0 mt-2 z-50 rounded-2xl bg-card border border-border shadow-card overflow-hidden"
          >
            {showEmpty ? (
              <div className="px-5 py-8 text-center">
                <div className="mx-auto h-10 w-10 rounded-full bg-primary-soft text-primary grid place-items-center">
                  <UserSearch className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-semibold text-foreground">No agent found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try searching with a different name or ID
                </p>
              </div>
            ) : (
              <ul className="py-1.5 max-h-80 overflow-y-auto" role="listbox">
                {suggestions.map((a, idx) => {
                  const active = idx === activeIdx;
                  return (
                    <li key={a.employeeId} role="option" aria-selected={active}>
                      <button
                        type="button"
                        onMouseEnter={() => setActiveIdx(idx)}
                        onClick={() => handleSelect(a)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          active ? "bg-primary-soft" : "hover:bg-muted/60"
                        }`}
                      >
                        <span className="h-8 w-8 rounded-full bg-gradient-primary text-primary-foreground grid place-items-center text-xs font-semibold shrink-0">
                          {a.name
                            .split(" ")
                            .map((p) => p[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-foreground truncate">
                            {highlight(a.name, debouncedSearchTerm)}
                          </span>
                          <span className="block text-[11px] text-muted-foreground truncate">
                            {highlight(a.employeeId, debouncedSearchTerm)} · {a.role}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0">
                          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[a.overallStatus]}`} />
                          <span className="text-xs font-semibold text-foreground">
                            {Math.round(a.overallScore)}%
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
                {filteredAgents.length > suggestions.length && (
                  <li className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border">
                    Showing top {suggestions.length} of {filteredAgents.length} matches
                  </li>
                )}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
