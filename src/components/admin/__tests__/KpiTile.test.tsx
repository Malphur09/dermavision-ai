import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { KpiTile } from "../KpiTile";

describe("KpiTile", () => {
  it("renders label, value, and delta", () => {
    render(
      <KpiTile label="Balanced accuracy" value="88.8%" delta="+33.8pp vs v1.0" />
    );
    expect(screen.getByText("Balanced accuracy")).toBeInTheDocument();
    expect(screen.getByText("88.8%")).toBeInTheDocument();
    expect(screen.getByText("+33.8pp vs v1.0")).toBeInTheDocument();
  });

  it("uses muted color in live mode (e.g. Scans today)", () => {
    const { container } = render(
      <KpiTile label="Scans today" value="14" delta="live" live />
    );
    const deltaRow = container.querySelector(
      ".flex.items-center.gap-1.text-xs"
    ) as HTMLElement;
    expect(deltaRow.style.color).toMatch(/muted-foreground/);
  });
});
