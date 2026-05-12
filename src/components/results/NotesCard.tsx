import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function NotesCard({
  notes,
  setNotes,
  onSave,
  saving,
  dirty,
}: {
  notes: string;
  setNotes: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Clinical notes</h3>
        {dirty && (
          <span className="text-[11px] mono text-muted-foreground">
            unsaved
          </span>
        )}
      </div>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={onSave}
        placeholder="Clinical impression, histology correlation, follow-up plan…"
        rows={5}
        className="resize-none text-sm"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          Auto-saves on blur · stored per case
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={onSave}
          disabled={!dirty || saving}
        >
          <Save size={12} /> {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
