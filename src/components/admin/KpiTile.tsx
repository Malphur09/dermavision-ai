import { TrendingUp } from "lucide-react";

export interface KpiTileProps {
  label: string;
  value: string;
  delta: string;
  live?: boolean;
}

export function KpiTile({ label, value, delta, live }: KpiTileProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-xs text-muted-foreground uppercase tracking-wide mono mb-2">
        {label}
      </div>
      <div className="text-3xl font-semibold tracking-tight mono">{value}</div>
      <div
        className="flex items-center gap-1 text-xs mt-3 pt-3 border-t border-border"
        style={{
          color: live ? "hsl(var(--muted-foreground))" : "hsl(var(--success))",
        }}
      >
        <TrendingUp size={12} /> {delta}
      </div>
    </div>
  );
}
