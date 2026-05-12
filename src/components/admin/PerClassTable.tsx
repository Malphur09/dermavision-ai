import { ISIC_CLASSES } from "@/lib/isic-classes";
import type { PerClass } from "@/lib/api-types";

export function PerClassTable({ perClass }: { perClass: PerClass[] }) {
  const classColor = (code: string) =>
    ISIC_CLASSES.find((c) => c.code === code)?.color ?? "hsl(var(--brand))";
  const displayName = (code: string) =>
    ISIC_CLASSES.find((c) => c.code === code)?.name ?? code;

  return (
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
            {["Class", "Precision", "Recall", "F1", "Support", ""].map((h) => (
              <th
                key={h}
                className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-5 py-3"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {perClass.map((c) => {
            const color = classColor(c.code);
            return (
              <tr
                key={c.code}
                className="border-b border-border last:border-0"
              >
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
                      {displayName(c.code)}
                    </span>
                    <span className="mono text-xs text-muted-foreground">
                      {c.code}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3 mono text-sm">
                  {c.precision.toFixed(3)}
                </td>
                <td className="px-5 py-3 mono text-sm">{c.recall.toFixed(3)}</td>
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
  );
}
