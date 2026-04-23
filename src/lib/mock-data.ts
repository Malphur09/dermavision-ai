// Shared reference data used across surfaces. Live model values come from
// /api/metrics/* and /api/model/* — this file only hosts presentation
// constants (colors, display names) and the canonical class ordering.

export type RiskBucket = "high" | "med" | "low";

export interface IsicClass {
  code: string;
  name: string;
  full: string;
  risk: RiskBucket;
  color: string;
}

export const ISIC_CLASSES: IsicClass[] = [
  { code: "MEL", name: "Melanoma", full: "Melanoma", risk: "high", color: "oklch(0.55 0.2 25)" },
  { code: "NV", name: "Melanocytic nevus", full: "Melanocytic Nevus", risk: "low", color: "oklch(0.55 0.12 160)" },
  { code: "BCC", name: "Basal cell carcinoma", full: "Basal Cell Carcinoma", risk: "high", color: "oklch(0.55 0.18 10)" },
  { code: "AK", name: "Actinic keratosis", full: "Actinic Keratosis", risk: "med", color: "oklch(0.65 0.16 60)" },
  { code: "BKL", name: "Benign keratosis", full: "Benign Keratosis-like Lesion", risk: "low", color: "oklch(0.6 0.1 140)" },
  { code: "DF", name: "Dermatofibroma", full: "Dermatofibroma", risk: "low", color: "oklch(0.55 0.1 280)" },
  { code: "VASC", name: "Vascular lesion", full: "Vascular Lesion", risk: "low", color: "oklch(0.55 0.18 340)" },
  { code: "SCC", name: "Squamous cell carcinoma", full: "Squamous Cell Carcinoma", risk: "high", color: "oklch(0.55 0.18 40)" },
];
