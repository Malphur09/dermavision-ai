import { ReactNode } from "react";

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      className="mono border px-1.5 py-0.5 rounded bg-muted"
      style={{ fontSize: 10 }}
    >
      {children}
    </kbd>
  );
}
