import type { RankedClass } from "./constants";

export function ProbBars({
  ranked,
  topColor,
}: {
  ranked: RankedClass[];
  topColor: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">All 8 class probabilities</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            ISIC 2019 dermatoscopic classes · softmax output
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {ranked.map((c, i) => (
          <div key={c.code} className="flex items-center gap-3">
            <div className="flex-shrink-0 w-5 text-right">
              <span className="text-xs mono text-muted-foreground">{i + 1}</span>
            </div>
            <div style={{ width: 170 }}>
              <div className="text-sm font-medium truncate">{c.name}</div>
              <div className="text-xs mono text-muted-foreground">{c.code}</div>
            </div>
            <div
              className="flex-1 relative rounded overflow-hidden"
              style={{ height: 10, background: "hsl(var(--muted))" }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${c.p * 100}%`,
                  background:
                    i === 0 ? topColor : "hsl(var(--muted-foreground) / 0.4)",
                  transition: "width 0.6s ease",
                }}
              />
            </div>
            <div className="mono text-sm font-medium w-16 text-right">
              {(c.p * 100).toFixed(c.p < 0.01 ? 2 : 1)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
