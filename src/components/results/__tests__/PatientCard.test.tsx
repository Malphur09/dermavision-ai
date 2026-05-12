import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { PatientCard } from "../PatientCard";

describe("PatientCard", () => {
  it("renders name, label, site, and status badge", () => {
    render(
      <PatientCard
        name="نورا القحطاني"
        label="PT-2026-002 · نورة السبيعي"
        lesionSite="back"
        status="reviewed"
      />
    );
    expect(screen.getByText("نورا القحطاني")).toBeInTheDocument();
    expect(screen.getByText(/PT-2026-002/)).toBeInTheDocument();
    expect(screen.getByText("back")).toBeInTheDocument();
    expect(screen.getByText("Reviewed")).toBeInTheDocument();
  });

  it("falls back to pending status label for unknown values", () => {
    render(
      <PatientCard
        name="A"
        label="PT-A"
        lesionSite=""
        status="something-weird"
      />
    );
    // em-dash when lesionSite is empty
    expect(screen.getByText("—")).toBeInTheDocument();
    // Unknown status falls through to STATUS_META.pending
    expect(screen.getByText("Awaiting review")).toBeInTheDocument();
  });
});
