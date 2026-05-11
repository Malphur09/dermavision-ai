import { AlertTriangle, Sparkles } from "lucide-react";

import type { RankedClass, RiskStyle } from "./constants";

export function TopPrediction({
  top,
  second,
  risk,
}: {
  top: RankedClass;
  second?: { p: number };
  risk: RiskStyle;
}) {
  const margin = second ? (top.p - second.p) * 100 : 0;
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 uppercase tracking-wide mono">
        <Sparkles size={12} /> Top prediction
      </div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight mb-1">
            {top.name}
          </h2>
          <div className="text-sm text-muted-foreground mono">
            ISIC · {top.code}
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded px-3 py-1 text-xs font-medium"
          style={{
            background: risk.bg,
            color: risk.color,
            border: `1px solid ${risk.color}33`,
          }}
        >
          <AlertTriangle size={11} /> {risk.label}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <div
          className="text-5xl font-semibold mono tracking-tight"
          style={{ color: risk.color }}
        >
          {(top.p * 100).toFixed(1)}%
        </div>
        <div className="text-sm text-muted-foreground">confidence</div>
      </div>
      <div
        className="mt-3 rounded-full overflow-hidden"
        style={{ height: 8, background: "hsl(var(--muted))" }}
      >
        <div
          style={{
            height: "100%",
            width: `${top.p * 100}%`,
            background: risk.color,
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <div className="text-xs text-muted-foreground mt-2 mono">
        Margin over 2nd:{" "}
        <span className="font-medium text-foreground">+{margin.toFixed(1)}pp</span>
      </div>
    </div>
  );
}
