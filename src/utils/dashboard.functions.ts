import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { computeDashboard, parseWorkbookFromArrayBuffer } from "@/lib/kpi-engine";
import type { DashboardData } from "@/lib/kpi-types";

const FileSchema = z.object({
  name: z.string().min(1).max(255),
  base64: z.string().min(1),
});

const InputSchema = z.object({
  files: z.array(FileSchema).min(1).max(10),
});

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  // Strip data url prefix if present
  const idx = b64.indexOf(",");
  const pure = idx >= 0 ? b64.slice(idx + 1) : b64;
  const binary = atob(pure);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export const processDashboard = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<DashboardData> => {
    const allRows: Record<string, unknown>[] = [];
    for (const f of data.files) {
      try {
        const buf = base64ToArrayBuffer(f.base64);
        const rows = parseWorkbookFromArrayBuffer(buf);
        allRows.push(...rows);
      } catch (err) {
        console.error(`Failed to parse ${f.name}:`, err);
        throw new Error(`Could not read "${f.name}". Make sure it is a valid .xlsx or .csv file.`);
      }
    }
    return computeDashboard(allRows, data.files.length);
  });
