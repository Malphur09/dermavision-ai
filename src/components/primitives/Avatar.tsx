export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue = (name.charCodeAt(0) * 12) % 360;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-medium flex-shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `oklch(0.88 0.04 ${hue})`,
        color: `oklch(0.28 0.06 ${hue})`,
      }}
    >
      {initials}
    </span>
  );
}
