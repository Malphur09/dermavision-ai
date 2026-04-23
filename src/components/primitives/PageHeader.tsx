import { ChevronRight } from "lucide-react";
import { Fragment, ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumb?: string[];
}) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
      <div>
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            {breadcrumb.map((b, i) => (
              <Fragment key={i}>
                {i > 0 && <ChevronRight size={10} />}
                <span>{b}</span>
              </Fragment>
            ))}
          </div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
