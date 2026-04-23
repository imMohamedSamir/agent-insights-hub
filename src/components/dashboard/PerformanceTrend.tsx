import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { TrendPoint } from "@/lib/kpi-types";

export function PerformanceTrend({ data }: { data: TrendPoint[] }) {
  // Pad to 7 days using MON..SUN labels
  const order = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const map = new Map(data.map((d) => [d.day, d]));
  const padded = order.map(
    (d) => map.get(d) ?? { day: d, date: "", score: null as unknown as number, target: data[0]?.target ?? 90 }
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-2xl bg-card shadow-card p-6 h-full flex flex-col"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold tracking-[0.18em] uppercase text-foreground">
          Performance Trend (7 days)
        </h3>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            Score
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
            Target
          </span>
        </div>
      </div>
      <div className="mt-4 flex-1 min-h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={padded} margin={{ top: 12, right: 16, bottom: 8, left: -10 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="day"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                fontSize: 12,
                boxShadow: "var(--shadow-card)",
              }}
              cursor={{ stroke: "var(--primary)", strokeOpacity: 0.15 }}
            />
            <Line
              type="monotone"
              dataKey="target"
              stroke="var(--muted-foreground)"
              strokeOpacity={0.4}
              strokeDasharray="5 5"
              dot={false}
              isAnimationActive
              animationDuration={1200}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="var(--primary)"
              strokeWidth={3}
              dot={{ r: 4, fill: "var(--primary)" }}
              activeDot={{ r: 6 }}
              isAnimationActive
              animationDuration={1400}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
