import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { TopPrediction } from "../TopPrediction";
import { RISK_META } from "../constants";

describe("TopPrediction", () => {
  it("renders class name, code, confidence, and margin", () => {
    render(
      <TopPrediction
        top={{ name: "Melanoma", code: "MEL", p: 0.87, risk: "high" }}
        second={{ p: 0.07 }}
        risk={RISK_META.high}
      />
    );
    expect(screen.getByText("Melanoma")).toBeInTheDocument();
    expect(screen.getByText(/MEL/)).toBeInTheDocument();
    expect(screen.getByText("87.0%")).toBeInTheDocument();
    expect(screen.getByText("+80.0pp")).toBeInTheDocument();
    expect(screen.getByText("High risk")).toBeInTheDocument();
  });

  it("renders +0.0pp margin when there is no second class", () => {
    render(
      <TopPrediction
        top={{ name: "Melanocytic Nevus", code: "NV", p: 0.9, risk: "benign" }}
        risk={RISK_META.benign}
      />
    );
    expect(screen.getByText("+0.0pp")).toBeInTheDocument();
  });
});
