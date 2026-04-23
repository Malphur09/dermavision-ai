export type Colormap = "jet" | "viridis" | "inferno" | "magma";

const maps: Record<Colormap, string[]> = {
  jet: ["oklch(0.75 0.20 25)", "oklch(0.80 0.20 60)", "oklch(0.85 0.18 100)", "oklch(0.75 0.18 180)", "oklch(0.45 0.20 270)"],
  viridis: ["oklch(0.90 0.15 100)", "oklch(0.70 0.18 140)", "oklch(0.55 0.15 190)", "oklch(0.35 0.15 260)", "oklch(0.20 0.10 290)"],
  inferno: ["oklch(0.95 0.10 90)", "oklch(0.75 0.20 60)", "oklch(0.60 0.22 30)", "oklch(0.40 0.18 350)", "oklch(0.15 0.05 300)"],
  magma:  ["oklch(0.93 0.08 60)", "oklch(0.70 0.18 30)", "oklch(0.50 0.20 10)", "oklch(0.30 0.15 320)", "oklch(0.15 0.05 290)"],
};

const positions = [
  { x: 45, y: 55 }, { x: 50, y: 50 }, { x: 48, y: 52 },
  { x: 52, y: 48 }, { x: 44, y: 56 }, { x: 50, y: 50 },
];

export function HeatmapOverlay({
  intensity = 0.7,
  colormap = "jet",
  variant = 0,
}: {
  intensity?: number;
  colormap?: Colormap;
  variant?: number;
}) {
  const p = positions[variant % positions.length];
  const c = maps[colormap];
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity: intensity,
        mixBlendMode: "screen",
        background: `radial-gradient(circle at ${p.x}% ${p.y}%,
          ${c[0]} 0%,
          ${c[1]} 12%,
          ${c[2]} 24%,
          ${c[3]} 38%,
          ${c[4]} 52%,
          transparent 75%)`,
      }}
    />
  );
}
