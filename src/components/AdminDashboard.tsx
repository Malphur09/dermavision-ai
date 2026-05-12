"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/primitives/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type {
  ConfusionPayload,
  DriftPayload,
  LatencyPayload,
  MetricsSummary,
  PerClass,
} from "@/lib/api-types";
import { KpiTile } from "@/components/admin/KpiTile";
import { HeadlineMetricsRow } from "@/components/admin/HeadlineMetricsRow";
import { ConfusionMatrixCard } from "@/components/admin/ConfusionMatrixCard";
import { LatencyCard } from "@/components/admin/LatencyCard";
import { DriftCard } from "@/components/admin/DriftCard";
import { PerClassTable } from "@/components/admin/PerClassTable";

type Range = "24h" | "7d" | "30d" | "all";

export function AdminDashboard() {
  const router = useRouter();
  const [scansToday, setScansToday] = useState<number | null>(null);
  const [range, setRange] = useState<Range>("7d");
  const [exporting, setExporting] = useState(false);
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [perClass, setPerClass] = useState<PerClass[]>([]);
  const [drift, setDrift] = useState<DriftPayload | null>(null);
  const [confusion, setConfusion] = useState<ConfusionPayload | null>(null);
  const [latency, setLatency] = useState<LatencyPayload | null>(null);

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
      const [s, p, d, cm, lat] = await Promise.all([
        fetchJson<MetricsSummary>("/api/metrics/summary"),
        fetchJson<{ classes: PerClass[] }>("/api/metrics/per_class"),
        fetchJson<DriftPayload>("/api/metrics/drift"),
        fetchJson<ConfusionPayload>("/api/metrics/confusion"),
        fetchJson<LatencyPayload>("/api/metrics/latency"),
      ]);
      if (s) setSummary(s);
      if (p?.classes) setPerClass(p.classes);
      if (d) setDrift(d);
      if (cm) setConfusion(cm);
      if (lat) setLatency(lat);
    };
    void load();
  }, []);

  const prev = summary?.previous ?? null;
  const fmtDelta = (
    curr: number | undefined,
    prior: number | undefined,
    fmt: (n: number) => string
  ) => {
    if (curr == null || prior == null || !prev) return "test-set holdout";
    const d = curr - prior;
    const sign = d >= 0 ? "+" : "−";
    return `${sign}${fmt(Math.abs(d))} vs ${prev.version}`;
  };

  const kpis = [
    {
      label: "Balanced accuracy",
      value: summary ? `${(summary.balanced_acc * 100).toFixed(1)}%` : "—",
      delta: fmtDelta(
        summary?.balanced_acc,
        prev?.balanced_acc,
        (n) => `${(n * 100).toFixed(1)}pp`
      ),
    },
    {
      label: "Macro F1",
      value: summary ? summary.macro_f1.toFixed(3) : "—",
      delta: fmtDelta(summary?.macro_f1, prev?.macro_f1, (n) => n.toFixed(3)),
    },
    {
      label: "Inference p50",
      value: summary ? `${summary.p50_latency_ms}ms` : "—",
      delta: "rolling 7d",
    },
    {
      label: "Scans today",
      value: scansToday == null ? "—" : scansToday.toLocaleString(),
      delta: scansToday == null ? "loading…" : "live",
      live: true,
    },
  ];

  const rangeSince = (): string | null => {
    if (range === "all") return null;
    const d = new Date();
    const hours = range === "24h" ? 24 : range === "7d" ? 24 * 7 : 24 * 30;
    d.setHours(d.getHours() - hours);
    return d.toISOString();
  };

  const csvEscape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const supabase = createClient();
      let q = supabase
        .from("cases")
        .select(
          "id,created_at,predicted_class,confidence,risk_level,status,lesion_site"
        )
        .order("created_at", { ascending: false });
      const since = rangeSince();
      if (since) q = q.gte("created_at", since);
      const { data, error } = await q;
      if (error) {
        toast.error(error.message || "Export failed");
        return;
      }
      const rows = data ?? [];
      const header = [
        "id",
        "created_at",
        "predicted_class",
        "confidence",
        "risk_level",
        "status",
        "lesion_site",
      ];
      const csv = [
        header.join(","),
        ...rows.map((r) =>
          header
            .map((k) => csvEscape((r as Record<string, unknown>)[k]))
            .join(",")
        ),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cases-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} case${rows.length === 1 ? "" : "s"}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Model metrics"
        subtitle={
          summary?.version ? `Production: ${summary.version}` : "Production model"
        }
        breadcrumb={["Admin", "Model metrics"]}
        actions={
          <>
            <div
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card pl-3 pr-1 h-9"
              title="Time window applied to the CSV export below"
            >
              <span className="text-xs text-muted-foreground mono uppercase tracking-wide">
                Export
              </span>
              <Select value={range} onValueChange={(v) => setRange(v as Range)}>
                <SelectTrigger className="h-7 w-[120px] border-0 shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24h</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExport}
                disabled={exporting}
                className="h-7 px-2"
              >
                <Download size={14} /> {exporting ? "Exporting…" : "Export"}
              </Button>
            </div>
            <Button variant="brand" onClick={() => router.push("/admin/publish")}>
              <Upload size={14} /> New model version
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k) => (
          <KpiTile key={k.label} {...k} />
        ))}
      </div>

      <HeadlineMetricsRow summary={summary} />

      <div className="grid gap-5 mb-6 lg:grid-cols-[1.2fr_1fr]">
        <ConfusionMatrixCard confusion={confusion} />
        <div className="flex flex-col gap-5">
          <LatencyCard latency={latency} />
          <DriftCard drift={drift} />
        </div>
      </div>

      <PerClassTable perClass={perClass} />
    </div>
  );
}
