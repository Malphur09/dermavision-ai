import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { PerClassTable } from "../PerClassTable";
import type { PerClass } from "@/lib/api-types";

const rows: PerClass[] = [
  {
    code: "MEL",
    full: "Melanoma",
    precision: 0.94,
    recall: 0.86,
    f1: 0.9,
    support: 452,
  },
  {
    code: "NV",
    full: "Melanocytic Nevus",
    precision: 0.94,
    recall: 0.98,
    f1: 0.962,
    support: 1288,
  },
];

describe("PerClassTable", () => {
  it("renders one row per class with precision/recall/f1/support", () => {
    render(<PerClassTable perClass={rows} />);
    // ISIC code shown
    expect(screen.getByText("MEL")).toBeInTheDocument();
    expect(screen.getByText("NV")).toBeInTheDocument();
    // F1 rendered with 3-decimal precision
    expect(screen.getByText("0.900")).toBeInTheDocument();
    expect(screen.getByText("0.962")).toBeInTheDocument();
    // Support raw integer
    expect(screen.getByText("452")).toBeInTheDocument();
    expect(screen.getByText("1288")).toBeInTheDocument();
  });

  it("renders empty table body when perClass is []", () => {
    render(<PerClassTable perClass={[]} />);
    // header still present
    expect(screen.getByText("Per-class performance")).toBeInTheDocument();
  });
});
