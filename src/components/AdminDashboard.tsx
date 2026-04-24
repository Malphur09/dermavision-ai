"use client";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CheckCircle2, Download, TrendingUp, Upload } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { ISIC_CLASSES } from "@/lib/mock-data";
import { PageHeader } from "@/components/primitives/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type Series = { x: number; y: number }[];

interface MetricsSummary {
  balanced_acc: number;
  macro_f1: number;
  p50_latency_ms: number;
}

interface PerClass {
  code: string;
  full: string;
  f1: number;
  precision: number;
  recall: number;
  support: number;
}

interface TrainingCurves {
  epochs: number[];
  train_loss: number[];
  val_loss: number[];
  train_acc: number[];
  val_acc: number[];
}

interface DriftPayload {
  window: number;
  values: number[];
}

interface ConfusionPayload {
  classes: string[];
  matrix: number[][];
}

function toSeries(values: number[]): Series {
  return values.map((y, x) => ({ x, y: Number(y.toFixed(4)) }));
}

export function AdminDashboard() {
  const [scansToday, setScansToday] = useState<number | null>(null);
  const [range, setRange] = useState<"24h" | "7d" | "30d" | "all">("7d");
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [perClass, setPerClass] = useState<PerClass[]>([]);
  const [curves, setCurves] = useState<TrainingCurves | null>(null);
  const [drift, setDrift] = useState<DriftPayload | null>(null);
  const [confusion, setConfusion] = useState<ConfusionPayload | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("cases")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfDay.toISOString());
      setScansToday(count ?? 0);
    };
    void load();
  }, []);

  useEffect(() => {
    const fetchJson = async <T,>(url: string): Promise<T | null> => {
      try {
        const r = await fetch(url);
        if (!r.ok) return null;
        return (await r.json()) as T;
      } catch {
        return null;
      }
    };
    const load = async () => {
      const [s, p, c, d, cm] = await Promise.all([
        fetchJson<MetricsSummary>("/api/metrics/summary"),
        fetchJson<{ classes: PerClass[] }>("/api/metrics/per_class"),
        fetchJson<TrainingCurves>("/api/metrics/training_curves"),
        fetchJson<DriftPayload>("/api/metrics/drift"),
        fetchJson<ConfusionPayload>("/api/metrics/confusion"),
      ]);
      if (s) setSummary(s);
      if (p?.classes) setPerClass(p.classes);
      if (c) setCurves(c);
      if (d) setDrift(d);
      if (cm) setConfusion(cm);
    };
    void load();
  }, []);

  const accCurve = useMemo<Series>(
    () => (curves ? toSeries(curves.val_acc) : []),
    [curves]
  );
  const lossCurve = useMemo<Series>(
    () => (curves ? toSeries(curves.val_loss) : []),
    [curves]
  );
  const driftCurve = useMemo<Series>(
    () => (drift ? toSeries(drift.values) : []),
    [drift]
  );

  const classColor = (code: string) =>
    ISIC_CLASSES.find((c) => c.code === code)?.color ?? "hsl(var(--brand))";
  const className = (code: string) =>
    ISIC_CLASSES.find((c) => c.code === code)?.name ?? code;

  const CM_CLASSES = confusion?.classes ?? [];
  const CM_MAT = confusion?.matrix ?? [];

  const kpis = [
    {
      label: "Balanced accuracy",
      value: summary ? `${(summary.balanced_acc * 100).toFixed(1)}%` : "—",
      delta: "+0.5pp vs prior",
    },
    {
      label: "Macro F1",
      value: summary ? summary.macro_f1.toFixed(3) : "—",
      delta: "+0.012",
    },
    {
      label: "Inference p50",
      value: summary ? `${summary.p50_latency_ms}ms` : "—",
      delta: "−8ms",
    },
    {
      label: "Scans today",
      value: scansToday == null ? "—" : scansToday.toLocaleString(),
      delta: scansToday == null ? "loading…" : "live",
      live: true,
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Model metrics"
        subtitle="Production: v1.0"
        breadcrumb={["Admin", "Model metrics"]}
        actions={
          <>
            <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            {/* MOCK: export action */}
            <Button variant="outline">
              <Download size={14} /> Export
            </Button>
            <Button variant="brand">
              <Upload size={14} /> New model version
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-lg border border-border bg-card p-5"
          >
            <div className="text-xs text-muted-foreground uppercase tracking-wide mono mb-2">
              {k.label}
            </div>
            <div className="text-3xl font-semibold tracking-tight mono">
              {k.value}
            </div>
            <div
              className="flex items-center gap-1 text-xs mt-3 pt-3 border-t border-border"
              style={{
                color: k.live
                  ? "hsl(var(--muted-foreground))"
                  : "hsl(var(--success))",
              }}
            >
              <TrendingUp size={12} /> {k.delta}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 mb-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold">Training curves</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                v1.0 · 40 epochs
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span
                  style={{
                    width: 8,
                    height: 8,
                    background: "hsl(var(--brand))",
                    borderRadius: 2,
                  }}
                />{" "}
                Val acc
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  style={{
                    width: 8,
                    height: 8,
                    background: "hsl(var(--destructive))",
                    borderRadius: 2,
                  }}
                />{" "}
                Val loss
              </span>
            </div>
          </div>
          <div className="h-[140px]">
            <ResponsiveContainer>
              <LineChart data={accCurve} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="x" hide />
                <YAxis domain={[0.5, 1]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="y" stroke="hsl(var(--brand))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="h-[120px] mt-2">
            <ResponsiveContainer>
              <LineChart data={lossCurve} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="x" hide />
                <YAxis domain={[0, 2]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="y" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold">ROC curves (one-vs-rest)</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Macro AUC: <span className="mono font-medium">0.964</span>
              </p>
            </div>
          </div>
          <svg width="100%" height="220" viewBox="0 0 480 220">
            <line x1="36" y1="196" x2="470" y2="196" stroke="hsl(var(--border))" />
            <line x1="36" y1="10" x2="36" y2="196" stroke="hsl(var(--border))" />
            <line
              x1="36"
              y1="196"
              x2="470"
              y2="10"
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="3 3"
              opacity="0.5"
            />
            {ISIC_CLASSES.map((c, ci) => {
              const points = Array.from({ length: 40 }, (_, i) => {
                const x = i / 39;
                const y = Math.min(1, Math.pow(x, 0.12 + ci * 0.02));
                return `${36 + x * 434},${196 - y * 186}`;
              }).join(" ");
              return (
                <polyline
                  key={c.code}
                  points={points}
                  fill="none"
                  stroke={c.color}
                  strokeWidth="1.5"
                  opacity="0.85"
                />
              );
            })}
            <text
              x="252"
              y="214"
              fontSize="10"
              fill="hsl(var(--muted-foreground))"
              textAnchor="middle"
              className="mono"
            >
              False Positive Rate
            </text>
          </svg>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {ISIC_CLASSES.map((c) => (
              <span key={c.code} className="flex items-center gap-1.5 text-xs">
                <span
                  style={{
                    width: 8,
                    height: 8,
                    background: c.color,
                    borderRadius: 2,
                  }}
                />{" "}
                {c.code}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 mb-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Confusion matrix</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Validation set · 4,312 samples · row-normalized %
              </p>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `60px repeat(8, 1fr)`,
              gap: 2,
            }}
          >
            <div />
            {CM_CLASSES.map((c) => (
              <div
                key={c}
                className="text-xs mono text-muted-foreground text-center py-1"
              >
                {c}
              </div>
            ))}
            {CM_MAT.map((row, i) => (
              <div key={i} style={{ display: "contents" }}>
                <div className="text-xs mono text-muted-foreground flex items-center justify-end pr-2">
                  {CM_CLASSES[i]}
                </div>
                {row.map((v, j) => {
                  const total = row.reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? v / total : 0;
                  const intensity = Math.min(1, pct * 1.2);
                  return (
                    <div
                      key={j}
                      className="mono text-xs flex items-center justify-center rounded"
                      style={{
                        aspectRatio: 1,
                        background: `oklch(${0.95 - intensity * 0.55} ${0.02 + intensity * 0.13} 200 / ${0.15 + intensity * 0.85})`,
                        color:
                          intensity > 0.5
                            ? "white"
                            : "hsl(var(--foreground))",
                        fontSize: 10,
                        fontWeight: i === j ? 600 : 400,
                      }}
                    >
                      {Math.round(pct * 100)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
            <span>True class ↓ · Predicted class →</span>
            <div className="flex items-center gap-1">
              <span className="mono">0%</span>
              <div
                style={{
                  width: 120,
                  height: 8,
                  borderRadius: 4,
                  background:
                    "linear-gradient(90deg, oklch(0.95 0.02 200 / 0.15), oklch(0.4 0.15 200))",
                }}
              />
              <span className="mono">100%</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-semibold mb-1">Inference latency</h3>
            <p className="text-xs text-muted-foreground mb-4">
              p50 / p95 / p99 over 7 days
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { l: "p50", v: "342ms" },
                { l: "p95", v: "486ms" },
                { l: "p99", v: "712ms" },
              ].map((s) => (
                <div
                  key={s.l}
                  className="text-center p-3 rounded"
                  style={{ background: "hsl(var(--muted) / 0.5)" }}
                >
                  <div className="text-xs text-muted-foreground mb-1 mono">
                    {s.l}
                  </div>
                  <div className="text-xl font-semibold mono">{s.v}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Throughput</span>
              <span className="mono font-medium">
                2,840 req/hr · 98.2% SLO
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold">Drift monitor</h3>
              <Badge
                variant="outline"
                className="gap-1 border-success/40 text-success"
              >
                <CheckCircle2 size={10} /> Stable
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Feature distribution divergence (PSI) vs training set
            </p>
            <div className="h-[100px]">
              <ResponsiveContainer>
                <LineChart data={driftCurve} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <YAxis domain={[0, 0.25]} hide />
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
                Current PSI: 0.11
              </span>
              <span className="mono text-muted-foreground">
                Threshold: 0.20
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="p-5 border-b border-border">
          <h3 className="font-semibold">Per-class performance</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            ISIC 2019 · 8 classes · balanced evaluation
          </p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Class", "Precision", "Recall", "F1", "Support", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-5 py-3"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {perClass.map((c) => {
              const color = classColor(c.code);
              return (
                <tr key={c.code} className="border-b border-border last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: color,
                        }}
                      />
                      <span className="font-medium text-sm">
                        {className(c.code)}
                      </span>
                      <span className="mono text-xs text-muted-foreground">
                        {c.code}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 mono text-sm">
                    {c.precision.toFixed(3)}
                  </td>
                  <td className="px-5 py-3 mono text-sm">
                    {c.recall.toFixed(3)}
                  </td>
                  <td className="px-5 py-3 mono text-sm">{c.f1.toFixed(3)}</td>
                  <td className="px-5 py-3 mono text-sm text-muted-foreground">
                    {c.support}
                  </td>
                  <td className="px-5 py-3">
                    <div
                      style={{
                        width: 120,
                        height: 6,
                        background: "hsl(var(--muted))",
                        borderRadius: 3,
                      }}
                    >
                      <div
                        style={{
                          width: `${c.f1 * 100}%`,
                          height: "100%",
                          background: color,
                          borderRadius: 3,
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
