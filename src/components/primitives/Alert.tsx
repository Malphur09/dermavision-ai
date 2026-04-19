import { Info, AlertTriangle, CheckCircle } from "lucide-react";
import { ReactNode } from "react";

type Variant = "info" | "warning" | "danger" | "success";

const palette: Record<Variant, { bg: string; border: string; fg: string; Icon: typeof Info }> = {
  info:    { bg: "hsl(var(--brand) / 0.08)",       border: "hsl(var(--brand) / 0.2)",       fg: "hsl(var(--brand))",       Icon: Info },
  warning: { bg: "hsl(var(--warning) / 0.1)",      border: "hsl(var(--warning) / 0.25)",    fg: "hsl(var(--warning))",     Icon: AlertTriangle },
  danger:  { bg: "hsl(var(--destructive) / 0.08)", border: "hsl(var(--destructive) / 0.2)", fg: "hsl(var(--destructive))", Icon: AlertTriangle },
  success: { bg: "hsl(var(--success) / 0.1)",      border: "hsl(var(--success) / 0.25)",    fg: "hsl(var(--success))",     Icon: CheckCircle },
};

export function Alert({
  variant = "info",
  title,
  children,
}: {
  variant?: Variant;
  title?: string;
  children?: ReactNode;
}) {
  const { bg, border, fg, Icon } = palette[variant];
  return (
    <div className="flex gap-3 p-3 rounded-md border" style={{ background: bg, borderColor: border }}>
      <div style={{ color: fg, flexShrink: 0, marginTop: 2 }}>
        <Icon size={16} />
      </div>
      <div className="flex-1">
        {title && <div className="font-medium text-sm mb-1" style={{ color: fg }}>{title}</div>}
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}
