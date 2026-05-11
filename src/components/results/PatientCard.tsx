import { MoreHorizontal } from "lucide-react";

import { Avatar } from "@/components/primitives/Avatar";
import { Button } from "@/components/ui/button";

import { STATUS_META } from "./constants";

export function PatientCard({
  name,
  label,
  lesionSite,
  status,
}: {
  name: string;
  label: string;
  lesionSite: string;
  status: string;
}) {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <Avatar name={name} size={44} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{name}</div>
          <div className="text-xs text-muted-foreground mono truncate">{label}</div>
        </div>
        <Button variant="ghost" size="icon">
          <MoreHorizontal size={14} />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Site</div>
          <div className="font-medium capitalize">{lesionSite || "—"}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Status</div>
          <span
            className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium mt-0.5"
            style={{
              background: meta.bg,
              color: meta.color,
              border: `1px solid ${meta.color}33`,
            }}
          >
            {meta.label}
          </span>
        </div>
      </div>
    </div>
  );
}
