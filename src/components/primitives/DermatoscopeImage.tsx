import { ReactNode } from "react";

type Variant = 0 | 1 | 2 | 3 | 4 | 5;

const variants = [
  { hue: 25, chroma: 0.09, pos: "45% 55%", shape: "irregular" },
  { hue: 30, chroma: 0.08, pos: "50% 50%", shape: "round" },
  { hue: 20, chroma: 0.10, pos: "48% 52%", shape: "irregular" },
  { hue: 35, chroma: 0.07, pos: "52% 48%", shape: "round" },
  { hue: 15, chroma: 0.11, pos: "44% 56%", shape: "irregular" },
  { hue: 28, chroma: 0.09, pos: "50% 50%", shape: "round" },
];

export function DermatoscopeImage({
  variant = 0,
  size = "100%",
  caption,
  children,
}: {
  variant?: Variant | number;
  size?: string | number;
  caption?: string;
  children?: ReactNode;
}) {
  const v = variants[variant % variants.length];
  const bg = `radial-gradient(circle at ${v.pos},
    oklch(0.32 ${v.chroma + 0.02} ${v.hue}) 0%,
    oklch(0.42 ${v.chroma} ${v.hue + 5}) ${v.shape === "irregular" ? "8%" : "10%"},
    oklch(0.55 ${v.chroma - 0.01} ${v.hue + 10}) 22%,
    oklch(0.70 ${v.chroma - 0.03} ${v.hue + 15}) 42%,
    oklch(0.80 ${v.chroma - 0.05} ${v.hue + 20}) 70%,
    oklch(0.84 ${v.chroma - 0.06} ${v.hue + 20}) 100%)`;

  const overlay = v.shape === "irregular"
    ? `radial-gradient(ellipse 22% 18% at 42% 52%, oklch(0.22 0.10 ${v.hue - 5} / 0.55) 0%, transparent 100%),
       radial-gradient(ellipse 12% 9% at 55% 58%, oklch(0.28 0.08 ${v.hue} / 0.40) 0%, transparent 100%),
       radial-gradient(ellipse 8% 6% at 38% 48%, oklch(0.25 0.09 ${v.hue + 3} / 0.50) 0%, transparent 100%)`
    : `radial-gradient(circle at 50% 50%, oklch(0.28 0.10 ${v.hue} / 0.50) 0%, transparent 20%)`;

  const vignette = `radial-gradient(circle at 50% 50%, transparent 60%, oklch(0.15 0.01 50 / 0.3) 88%, oklch(0.08 0.005 50 / 0.55) 100%)`;

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: size,
        height: size,
        aspectRatio: "1 / 1",
        borderRadius: "calc(var(--radius) - 2px)",
        background: bg,
      }}
    >
      <div className="absolute inset-0" style={{ background: overlay }} />
      <div className="absolute inset-0" style={{ background: vignette }} />
      {children}
      {caption && (
        <div
          className="absolute bottom-2 left-2 right-2 text-center mono uppercase tracking-wide px-2 py-1 rounded"
          style={{ background: "rgb(0 0 0 / 0.5)", color: "rgb(255 255 255 / 0.9)", fontSize: 9 }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}
