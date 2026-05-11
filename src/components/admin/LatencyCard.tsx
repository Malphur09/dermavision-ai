import type { LatencyPayload } from "@/lib/api-types";

export function LatencyCard({ latency }: { latency: LatencyPayload | null }) {
  const tiles = [
    { l: "p50", v: latency ? `${latency.p50_ms}ms` : "—" },
    { l: "p95", v: latency ? `${latency.p95_ms}ms` : "—" },
    { l: "p99", v: latency ? `${latency.p99_ms}ms` : "—" },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="font-semibold mb-1">Inference latency</h3>
      <p className="text-xs text-muted-foreground mb-4">
        p50 / p95 / p99 over 7 days
      </p>
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((s) => (
          <div
            key={s.l}
            className="text-center p-3 rounded"
            style={{ background: "hsl(var(--muted) / 0.5)" }}
          >
            <div className="text-xs text-muted-foreground mb-1 mono">{s.l}</div>
            <div className="text-xl font-semibold mono">{s.v}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Throughput</span>
        <span className="mono font-medium">
          {latency
            ? `${latency.throughput_per_hr.toLocaleString()} req/hr · ${latency.count.toLocaleString()} samples`
            : "—"}
        </span>
      </div>
    </div>
  );
}
