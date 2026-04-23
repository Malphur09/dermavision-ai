import { Check } from "lucide-react";
import { ComponentType, Fragment } from "react";

export type Step = {
  title: string;
  desc: string;
  Icon: ComponentType<{ size?: number }>;
};

export function Stepper({ steps, current }: { steps: Step[]; current: number }) {
  return (
    <div className="flex items-center">
      {steps.map((s, i) => (
        <Fragment key={i}>
          <div className="flex items-center gap-3 flex-1">
            <div
              className="rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                width: 36,
                height: 36,
                background:
                  i < current
                    ? "hsl(var(--brand))"
                    : i === current
                      ? "hsl(var(--brand) / 0.15)"
                      : "hsl(var(--muted))",
                color:
                  i < current
                    ? "hsl(var(--brand-foreground))"
                    : i === current
                      ? "hsl(var(--brand))"
                      : "hsl(var(--muted-foreground))",
                border: i === current ? "2px solid hsl(var(--brand))" : "none",
              }}
            >
              {i < current ? <Check size={16} /> : <s.Icon size={14} />}
            </div>
            <div>
              <div className="text-sm font-medium">{s.title}</div>
              <div className="text-xs text-muted-foreground">{s.desc}</div>
            </div>
          </div>
          {i < steps.length - 1 && (
            <div
              style={{
                height: 2,
                flex: "0 0 40px",
                background: i < current ? "hsl(var(--brand))" : "hsl(var(--border))",
                margin: "0 12px",
              }}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}
