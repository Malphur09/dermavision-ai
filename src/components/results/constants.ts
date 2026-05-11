export const ISIC_CODE: Record<string, string> = {
  Melanoma: "MEL",
  "Melanocytic Nevus": "NV",
  "Basal Cell Carcinoma": "BCC",
  "Actinic Keratosis": "AK",
  "Benign Keratosis": "BKL",
  Dermatofibroma: "DF",
  "Vascular Lesion": "VASC",
  "Squamous Cell Carcinoma": "SCC",
};

export type RiskBucket = "high" | "moderate" | "benign";

export const CLASS_RISK: Record<string, RiskBucket> = {
  Melanoma: "high",
  "Squamous Cell Carcinoma": "high",
  "Basal Cell Carcinoma": "high",
  "Actinic Keratosis": "moderate",
  "Melanocytic Nevus": "benign",
  "Benign Keratosis": "benign",
  Dermatofibroma: "benign",
  "Vascular Lesion": "benign",
};

export interface RiskStyle {
  label: string;
  color: string;
  bg: string;
}

export const RISK_META: Record<RiskBucket, RiskStyle> = {
  high: {
    label: "High risk",
    color: "hsl(var(--destructive))",
    bg: "hsl(var(--destructive) / 0.1)",
  },
  moderate: {
    label: "Moderate",
    color: "hsl(var(--warning))",
    bg: "hsl(var(--warning) / 0.12)",
  },
  benign: {
    label: "Benign",
    color: "hsl(var(--success))",
    bg: "hsl(var(--success) / 0.12)",
  },
};

export const STATUS_META: Record<string, RiskStyle> = {
  pending: {
    label: "Awaiting review",
    color: "hsl(var(--warning))",
    bg: "hsl(var(--warning) / 0.12)",
  },
  reviewed: {
    label: "Reviewed",
    color: "hsl(var(--success))",
    bg: "hsl(var(--success) / 0.12)",
  },
  complete: {
    label: "Complete",
    color: "hsl(var(--success))",
    bg: "hsl(var(--success) / 0.12)",
  },
};

export const NEXT_STEPS: Record<string, string[]> = {
  MEL: [
    "Refer to dermatologic oncology within 1–2 weeks",
    "Excisional biopsy with 2mm margin recommended",
    "Discuss sentinel lymph node mapping if Breslow > 0.8mm",
    "Total body photography for baseline surveillance",
  ],
  BCC: [
    "Shave or punch biopsy for histologic confirmation",
    "Mohs surgery consideration for high-risk sites",
    "Counsel on photoprotection and self-surveillance",
  ],
  SCC: [
    "Punch biopsy for confirmation of diagnosis",
    "Assess for perineural involvement on history",
    "Surgical excision with 4–6mm margin",
  ],
  AK: [
    "Cryotherapy or topical 5-FU first-line",
    "Sun protection counseling",
    "Annual full-body skin examination",
  ],
  NV: [
    "Routine surveillance — photo record for comparison",
    "Patient education on ABCDE self-monitoring",
    "Re-evaluate in 6–12 months if stable",
  ],
  BKL: [
    "Reassurance — benign process",
    "Cosmetic removal optional (cryotherapy/curettage)",
  ],
  DF: [
    "Reassurance — characteristic dimple sign",
    "Excision only if symptomatic or cosmetic concern",
  ],
  VASC: [
    "Reassurance — benign vascular lesion",
    "Cosmetic laser therapy available if desired",
  ],
};

export interface CaseSession {
  caseId: string;
  patientLabel?: string;
  patientId?: string;
  patientName?: string;
  predictedClass: string;
  probabilities: Record<string, number>;
  confidence: number | null;
  riskLevel: string;
  lesionSite: string;
  storagePath: string;
  heatmapDataUrl: string | null;
  status?: string;
  notes?: string | null;
}

export interface RankedClass {
  name: string;
  code: string;
  p: number;
  risk: RiskBucket;
}
