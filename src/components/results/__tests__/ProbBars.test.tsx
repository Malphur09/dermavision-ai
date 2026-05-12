import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { ProbBars } from "../ProbBars";

describe("ProbBars", () => {
  it("renders one row per class with percentage", () => {
    render(
      <ProbBars
        ranked={[
          { name: "Melanoma", code: "MEL", p: 0.87, risk: "high" },
          { name: "Melanocytic Nevus", code: "NV", p: 0.07, risk: "benign" },
          { name: "Vascular Lesion", code: "VASC", p: 0.005, risk: "benign" },
        ]}
        topColor="hsl(var(--destructive))"
      />
    );
    expect(screen.getByText("Melanoma")).toBeInTheDocument();
    expect(screen.getByText("87.0%")).toBeInTheDocument();
    expect(screen.getByText("7.0%")).toBeInTheDocument();
    // Sub-1% uses two-decimal precision
    expect(screen.getByText("0.50%")).toBeInTheDocument();
  });
});
