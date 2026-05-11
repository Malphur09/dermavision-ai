import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { HeadlineMetricsRow } from "../HeadlineMetricsRow";
import type { MetricsSummary } from "@/lib/api-types";

const summary: MetricsSummary = {
  balanced_acc: 0.8876,
  macro_f1: 0.9093,
  p50_latency_ms: 260,
  accuracy: 0.9349,
  weighted_f1: 0.9339,
  macro_auc_ovr: 0.9898,
  last_trained_at: "2026-05-07T20:16:32Z",
};

describe("HeadlineMetricsRow", () => {
  it("renders all four metrics from a populated summary", () => {
    render(<HeadlineMetricsRow summary={summary} />);
    expect(screen.getByText("93.49%")).toBeInTheDocument();
    expect(screen.getByText("0.9339")).toBeInTheDocument();
    expect(screen.getByText("0.9898")).toBeInTheDocument();
    expect(screen.getByText("2026-05-07")).toBeInTheDocument();
  });

  it("falls back to em-dash when summary is null", () => {
    render(<HeadlineMetricsRow summary={null} />);
    // 4 tiles × one dash apiece.
    expect(screen.getAllByText("—")).toHaveLength(4);
  });
});
