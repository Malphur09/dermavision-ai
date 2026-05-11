import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { LatencyCard } from "../LatencyCard";
import type { LatencyPayload } from "@/lib/api-types";

const latency: LatencyPayload = {
  p50_ms: 180,
  p95_ms: 320,
  p99_ms: 540,
  count: 1024,
  window_days: 7,
  throughput_per_hr: 6.1,
};

describe("LatencyCard", () => {
  it("renders the three latency tiles and throughput", () => {
    render(<LatencyCard latency={latency} />);
    expect(screen.getByText("180ms")).toBeInTheDocument();
    expect(screen.getByText("320ms")).toBeInTheDocument();
    expect(screen.getByText("540ms")).toBeInTheDocument();
    expect(screen.getByText(/6.1 req\/hr/)).toBeInTheDocument();
    expect(screen.getByText(/1,024 samples/)).toBeInTheDocument();
  });

  it("shows em-dashes when latency is null", () => {
    render(<LatencyCard latency={null} />);
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });
});
