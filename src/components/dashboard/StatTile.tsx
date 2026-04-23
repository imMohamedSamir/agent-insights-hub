import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { AnimatedNumber } from "./AnimatedNumber";

interface Props {
  icon: LucideIcon;
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  index?: number;
}

export function StatTile({ icon: Icon, label, value, decimals = 0, suffix = "", index = 0 }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, delay: 0.1 + index * 0.07 }}
      whileHover={{ y: -3 }}
      className="rounded-2xl bg-card shadow-card p-5"
    >
      <div className="text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-3 text-3xl font-extrabold text-foreground tracking-tight">
        <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
      </div>
      <div className="mt-1 text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
        {label}
      </div>
    </motion.div>
  );
}
