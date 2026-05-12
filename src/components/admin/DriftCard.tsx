import { useMemo } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, CheckCircle2, Eye } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { DriftPayload } from "@/lib/api-types";

type Series = { x: number; y: number }[];

function bandFor(avg: number | null): "stable" | "monitor" | "alert" {
  if (avg === null) return "stable";
  if (avg < 0.1) return "stable";
  if (avg < 0.25) return "monitor";
  return "alert";
}

export function DriftCard({ drift }: { drift: DriftPayload | null }) {
  const driftCurve = useMemo<Series>(
    () =>
      drift
        ? drift.values.map((y, x) => ({ x, y: Number(y.toFixed(4)) }))
        : [],
    [drift]
  );
  const driftCurrent =
    drift && drift.values.length > 0
      ? drift.values[drift.values.length - 1]
      : null;
  const drift7dAvg = useMemo<number | null>(() => {
    if (!drift || drift.values.length === 0) return null;
    const tail = drift.values.slice(-7);
    return tail.reduce((a, b) => a + b, 0) / tail.length;
  }, [drift]);
  const band = bandFor(drift7dAvg);

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold">Drift monitor</h3>
        <Badge
          variant="outline"
          className={
            band === "alert"
              ? "gap-1 border-destructive/40 text-destructive"
              : band === "monitor"
                ? "gap-1 border-warning/40 text-warning"
                : "gap-1 border-success/40 text-success"
          }
        >
          {band === "alert" ? (
            <AlertTriangle size={10} />
          ) : band === "monitor" ? (
            <Eye size={10} />
          ) : (
            <CheckCircle2 size={10} />
          )}
          {band === "alert"
            ? "Alert"
            : band === "monitor"
              ? "Monitor"
              : "Stable"}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Predicted-class distribution divergence (PSI) vs eval-set reference
      </p>
      <div className="h-[100px]">
        <ResponsiveContainer>
          <LineChart
            data={driftCurve}
            margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
          >
            <YAxis domain={[0, 0.5]} hide />
            <XAxis dataKey="x" hide />
            <Line
              type="monotone"
              dataKey="y"
              stroke="hsl(var(--brand))"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-between mt-2 text-xs">
        <span className="mono text-muted-foreground">
          Current PSI: {driftCurrent !== null ? driftCurrent.toFixed(3) : "—"}
        </span>
        <span className="mono text-muted-foreground">
          7d avg: {drift7dAvg !== null ? drift7dAvg.toFixed(3) : "—"}
        </span>
      </div>
    </div>
  );
}
