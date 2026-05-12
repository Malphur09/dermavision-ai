import { Info } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

function ImageSlot({
  label,
  src,
  pending,
}: {
  label: string;
  src: string | null;
  pending?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide mono mb-2">
        {label}
      </div>
      <div className="aspect-square rounded-md overflow-hidden bg-muted flex items-center justify-center">
        {pending ? (
          <span className="text-xs text-muted-foreground">Loading…</span>
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={label}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-xs text-muted-foreground">Unavailable</span>
        )}
      </div>
    </div>
  );
}

export function ImagePanel({
  imageUrl,
  loadingImage,
  heatmapDataUrl,
  heatmapPending,
  heatmapOn,
  setHeatmapOn,
  blend,
  setBlend,
}: {
  imageUrl: string | null;
  loadingImage: boolean;
  heatmapDataUrl: string | null;
  heatmapPending: boolean;
  heatmapOn: boolean;
  setHeatmapOn: (v: boolean) => void;
  blend: number;
  setBlend: (v: number) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">Visual analysis</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Grad-CAM attribution
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Heatmap</span>
          <Switch
            checked={heatmapOn}
            onCheckedChange={setHeatmapOn}
            disabled={!heatmapDataUrl}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ImageSlot label="Original" src={imageUrl} pending={loadingImage} />
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide mono mb-2">
            Grad-CAM overlay
          </div>
          <div
            className="relative aspect-square rounded-md overflow-hidden bg-muted"
            style={{
              borderRadius: "calc(var(--radius) - 2px)",
            }}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Original"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                {loadingImage ? "Loading…" : "Image unavailable"}
              </div>
            )}
            {heatmapDataUrl && heatmapOn && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heatmapDataUrl}
                alt="Grad-CAM overlay"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                style={{ opacity: blend / 100 }}
              />
            )}
            {heatmapPending && (
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] mono px-2 py-1 rounded">
                Generating…
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 pt-5 border-t border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Blend: original ↔ heatmap
          </span>
          <span className="mono text-xs text-muted-foreground">{blend}%</span>
        </div>
        <Slider
          value={[blend]}
          min={0}
          max={100}
          step={1}
          onValueChange={(v) => setBlend(v[0])}
          disabled={!heatmapDataUrl || !heatmapOn}
        />
        <div className="flex items-center justify-between mt-1 text-xs mono text-muted-foreground">
          <span>Original</span>
          <span>50 / 50</span>
          <span>Heatmap</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 p-3 rounded bg-muted/50">
        <Info size={14} className="text-muted-foreground flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          Warm regions indicate where the model focused attention.
        </p>
      </div>
    </div>
  );
}
