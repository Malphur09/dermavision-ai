import type { ConfusionPayload } from "@/lib/api-types";

export function ConfusionMatrixCard({
  confusion,
}: {
  confusion: ConfusionPayload | null;
}) {
  const classes = confusion?.classes ?? [];
  const matrix = confusion?.matrix ?? [];
  const total = matrix.reduce(
    (sum, row) => sum + row.reduce((s, v) => s + v, 0),
    0
  );

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">Confusion matrix</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total > 0
              ? `Test set · ${total.toLocaleString()} samples · row-normalized %`
              : "Test set · row-normalized %"}
          </p>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `60px repeat(${classes.length || 8}, 1fr)`,
          gap: 2,
        }}
      >
        <div />
        {classes.map((c) => (
          <div
            key={c}
            className="text-xs mono text-muted-foreground text-center py-1"
          >
            {c}
          </div>
        ))}
        {matrix.map((row, i) => (
          <div key={i} style={{ display: "contents" }}>
            <div className="text-xs mono text-muted-foreground flex items-center justify-end pr-2">
              {classes[i]}
            </div>
            {row.map((v, j) => {
              const rowTotal = row.reduce((a, b) => a + b, 0);
              const pct = rowTotal > 0 ? v / rowTotal : 0;
              const intensity = Math.min(1, pct * 1.2);
              return (
                <div
                  key={j}
                  className="mono text-xs flex items-center justify-center rounded"
                  style={{
                    aspectRatio: 1,
                    background: `oklch(${0.95 - intensity * 0.55} ${0.02 + intensity * 0.13} 200 / ${0.15 + intensity * 0.85})`,
                    color:
                      intensity > 0.5 ? "white" : "hsl(var(--foreground))",
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
  );
}
