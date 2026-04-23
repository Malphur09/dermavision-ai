export function Logo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
        <rect x="4" y="4" width="24" height="24" rx="6" fill="hsl(var(--brand))" />
        <circle cx="16" cy="16" r="8" stroke="hsl(var(--brand-foreground))" strokeWidth="1.5" fill="none" opacity="0.9" />
        <circle cx="16" cy="16" r="4" stroke="hsl(var(--brand-foreground))" strokeWidth="1.5" fill="none" opacity="0.7" />
        <circle cx="16" cy="16" r="1.5" fill="hsl(var(--brand-foreground))" />
      </svg>
    </span>
  );
}

export function LogoWord({ size = 24 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Logo size={size} />
      <span className="font-semibold tracking-tight" style={{ fontSize: size * 0.65 }}>
        DermaVision <span className="text-muted-foreground font-normal">AI</span>
      </span>
    </span>
  );
}
