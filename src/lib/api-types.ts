// Shared shapes for the Flask API responses consumed by the frontend.
// Keeping them here avoids drift when two screens both read the same endpoint.
// Source-of-truth for the values is api/metrics.py + api/model_lifecycle.py.

export type ModelStatus = "production" | "staging" | "archived";

export interface ModelVersion {
  version: string;
  status: ModelStatus;
  // Populated server-side from model_metrics.summary.balanced_acc for that version.
  // Null when no metrics row exists for the version yet.
  accuracy: number | null;
  date: string;
  architecture: string | null;
  params: string | null;
  notes: string | null;
}

export interface PerClass {
  code: string;
  full: string;
  f1: number;
  precision: number;
  recall: number;
  support: number;
}

export interface MetricsSummaryPrevious {
  version: string;
  balanced_acc: number;
  macro_f1: number;
  p50_latency_ms?: number;
}

export interface MetricsSummary {
  version?: string | null;
  balanced_acc: number;
  macro_f1: number;
  p50_latency_ms: number;
  accuracy?: number | null;
  weighted_f1?: number | null;
  macro_auc_ovr?: number | null;
  last_trained_at?: string | null;
  previous?: MetricsSummaryPrevious | null;
}

export interface ConfusionPayload {
  classes: string[];
  matrix: number[][];
}

export interface DriftPayload {
  window: number;
  values: number[];
}

export interface LatencyPayload {
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  count: number;
  window_days: number;
  throughput_per_hr: number;
}
