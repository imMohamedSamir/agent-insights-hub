import { useCallback, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileSpreadsheet, X, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useDashboard } from "@/state/dashboard-context";
import { processDashboard } from "@/utils/dashboard.functions";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload Data — Score Card Tool" },
      {
        name: "description",
        content: "Upload one or more Excel/CSV files and process them into agent KPIs.",
      },
    ],
  }),
  component: UploadPage,
});

interface QueuedFile {
  file: File;
  id: string;
  size: string;
}

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

const SCHEMA_COLUMNS = [
  { name: "Agent", desc: "Agent name" },
  { name: "Date", desc: "Day of activity" },
  { name: "Calls", desc: "Total calls handled" },
  { name: "HandleTime", desc: "Total handle time (seconds)" },
  { name: "FCR", desc: "First call resolution (% or 0–1)" },
  { name: "QAScore", desc: "Quality score (%)" },
  { name: "AdherenceMin", desc: "Adhered minutes" },
  { name: "ScheduledMin", desc: "Scheduled minutes" },
  { name: "TNPS", desc: "Transactional NPS (%)" },
  { name: "Rejected", desc: "Rejected interactions" },
  { name: "Tickets", desc: "Closed tickets" },
];

function UploadPage() {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [processing, setProcessing] = useState(false);
  const { setData } = useDashboard();
  const navigate = useNavigate();

  const onDrop = useCallback((accepted: File[]) => {
    setQueue((prev) => [
      ...prev,
      ...accepted.map((f) => ({
        file: f,
        id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 8)}`,
        size: fmtSize(f.size),
      })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
  });

  const remove = (id: string) => setQueue((q) => q.filter((f) => f.id !== id));

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const idx = result.indexOf(",");
        resolve(idx >= 0 ? result.slice(idx + 1) : result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleProcess = async () => {
    if (queue.length === 0) {
      toast.error("Add at least one file to process.");
      return;
    }
    setProcessing(true);
    try {
      const files = await Promise.all(
        queue.map(async (q) => ({ name: q.file.name, base64: await fileToBase64(q.file) }))
      );
      const result = await processDashboard({ data: { files } });
      setData(result);
      toast.success(`Processed ${result.rowsProcessed} rows from ${result.filesProcessed} file(s).`);
      navigate({ to: "/" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to process files.";
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AppShell title="DATA UPLOAD">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <div>
          <div
            {...getRootProps({
              className: `relative rounded-2xl border-2 border-dashed p-10 md:p-14 text-center cursor-pointer transition-colors bg-card shadow-card animate-fade-in ${
                isDragActive
                  ? "border-primary bg-primary-soft/40"
                  : "border-border hover:border-primary/50"
              }`,
            })}
          >
            <input {...getInputProps()} />
            <motion.div
              animate={{ y: isDragActive ? -4 : 0 }}
              className="mx-auto h-16 w-16 grid place-items-center rounded-2xl bg-primary-soft text-primary"
            >
              <UploadCloud className="h-8 w-8" />
            </motion.div>
            <h2 className="mt-5 text-lg font-bold text-foreground">
              {isDragActive ? "Drop your files here" : "Drag & drop Excel files"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              or click to browse — supports .xlsx, .xls, .csv (multiple files allowed)
            </p>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold tracking-[0.18em] uppercase text-foreground">
                Files queued ({queue.length})
              </h3>
              {queue.length > 0 && (
                <button
                  type="button"
                  onClick={() => setQueue([])}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {queue.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="rounded-xl bg-card shadow-card p-4 text-sm text-muted-foreground"
                  >
                    No files yet. Drag and drop above to get started.
                  </motion.div>
                )}
                {queue.map((q) => (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex items-center gap-3 rounded-xl bg-card shadow-card p-3 pr-4"
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary-soft text-primary grid place-items-center">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{q.file.name}</p>
                      <p className="text-xs text-muted-foreground">{q.size}</p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <button
                      type="button"
                      onClick={() => remove(q.id)}
                      aria-label={`Remove ${q.file.name}`}
                      className="h-8 w-8 grid place-items-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary-soft transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-end">
              <button
                type="button"
                onClick={handleProcess}
                disabled={processing || queue.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary text-primary-foreground px-6 py-3 text-sm font-bold tracking-[0.14em] uppercase shadow-elegant disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-glow transition-shadow"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4" />
                    Process Data
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <aside className="rounded-2xl bg-card shadow-card p-6 h-fit">
          <h3 className="text-sm font-bold tracking-[0.18em] uppercase text-foreground">
            Expected Columns
          </h3>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Headers are matched case-insensitively with common aliases (e.g. "Avg Handle Time" =
            "HandleTime"). Missing columns default to 0.
          </p>
          <ul className="mt-4 space-y-2">
            {SCHEMA_COLUMNS.map((c) => (
              <li
                key={c.name}
                className="flex items-start justify-between gap-3 text-xs border-b border-border/60 pb-2 last:border-0"
              >
                <span className="font-mono font-semibold text-foreground">{c.name}</span>
                <span className="text-muted-foreground text-right">{c.desc}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </AppShell>
  );
}
