import type { MetricsSummary } from "@/lib/api-types";

export function HeadlineMetricsRow({ summary }: { summary: MetricsSummary | null }) {
  const tiles = [
    {
      label: "Accuracy",
      value:
        summary?.accuracy != null
          ? `${(summary.accuracy * 100).toFixed(2)}%`
          : "—",
    },
    {
      label: "Weighted F1",
      value:
        summary?.weighted_f1 != null ? summary.weighted_f1.toFixed(4) : "—",
    },
    {
      label: "Macro AUC (OvR)",
      value:
        summary?.macro_auc_ovr != null
          ? summary.macro_auc_ovr.toFixed(4)
          : "—",
    },
    {
      label: "Last evaluated",
      value: summary?.last_trained_at
        ? new Date(summary.last_trained_at).toISOString().slice(0, 10)
        : "—",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {tiles.map((m) => (
        <div
          key={m.label}
          className="rounded-lg border border-border bg-card p-4"
        >
          <div className="text-xs text-muted-foreground uppercase tracking-wide mono mb-1">
            {m.label}
          </div>
          <div className="text-xl font-semibold tracking-tight mono">{m.value}</div>
        </div>
      ))}
    </div>
  );
}
