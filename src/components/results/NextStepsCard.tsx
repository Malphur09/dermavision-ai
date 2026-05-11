import { FileText } from "lucide-react";

export function NextStepsCard({ steps }: { steps: string[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div
          className="p-1.5 rounded"
          style={{
            background: "hsl(var(--brand) / 0.1)",
            color: "hsl(var(--brand))",
          }}
        >
          <FileText size={14} />
        </div>
        <h3 className="font-semibold">Suggested next steps</h3>
      </div>
      <ol className="flex flex-col gap-2.5">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span
              className="mono text-xs rounded-full flex-shrink-0 flex items-center justify-center font-medium"
              style={{
                width: 20,
                height: 20,
                background: "hsl(var(--brand) / 0.12)",
                color: "hsl(var(--brand))",
                marginTop: 1,
              }}
            >
              {i + 1}
            </span>
            <span className="leading-relaxed">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
