// MOCK: Seed data for UI surfaces that don't yet have real backends.
// Centralized here so each surface is trivially swappable once wired.

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

export interface ModelVersion {
  version: string;
  status: "production" | "staging" | "archived";
  accuracy: number;
  date: string;
  architecture: string;
  params: string;
  notes: string;
}

export const MODEL_VERSIONS: ModelVersion[] = [
  { version: "v3.2.1", status: "production", accuracy: 0.913, date: "2026-03-28", architecture: "EfficientNetV2-L + CBAM", params: "119M", notes: "Production model. Balanced augmentation with focal loss." },
  { version: "v3.3.0-rc1", status: "staging", accuracy: 0.921, date: "2026-04-11", architecture: "EfficientNetV2-L + CBAM", params: "120M", notes: "Release candidate. Improved recall on MEL and SCC classes." },
  { version: "v3.2.0", status: "archived", accuracy: 0.908, date: "2026-02-15", architecture: "EfficientNetV2-L", params: "118M", notes: "Previous baseline." },
  { version: "v3.1.4", status: "archived", accuracy: 0.895, date: "2025-12-04", architecture: "EfficientNetB4", params: "19M", notes: "Lightweight version for edge devices." },
];

export function mockConfusionMatrix() {
  const classes = ISIC_CLASSES.map((c) => c.code);
  const mat = classes.map((_row, i) =>
    classes.map((_col, j) => {
      if (i === j) return 80 + ((i * 13) % 15);
      const off = Math.abs(i - j);
      return Math.max(0, 8 - off * 2 + ((i + j) % 4));
    })
  );
  return { classes, mat };
}

export function seededCurve(len: number, seed: number, build: (i: number, rnd: number) => number): number[] {
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: len }, (_, i) => build(i, rnd()));
}

export interface RecentScan {
  id: string;
  patient: string;
  patientId: string;
  when: string;
  topClass: string;
  conf: number;
  risk: RiskBucket;
  by: string;
}

export const RECENT_SCANS: RecentScan[] = [
  { id: "S-48291", patient: "Margaret Chen", patientId: "P-10284", when: "12 min ago", topClass: "NV", conf: 0.92, risk: "low", by: "Dr. Voss" },
  { id: "S-48290", patient: "Daniel Reyes", patientId: "P-10291", when: "38 min ago", topClass: "MEL", conf: 0.87, risk: "high", by: "Dr. Voss" },
  { id: "S-48289", patient: "Hassan Nasser", patientId: "P-10318", when: "2h ago", topClass: "BCC", conf: 0.81, risk: "high", by: "Dr. Patel" },
  { id: "S-48288", patient: "Marcus Webb", patientId: "P-10342", when: "3h ago", topClass: "AK", conf: 0.74, risk: "med", by: "Dr. Voss" },
  { id: "S-48287", patient: "Sofia Marchetti", patientId: "P-10377", when: "5h ago", topClass: "VASC", conf: 0.95, risk: "low", by: "Dr. Crane" },
  { id: "S-48286", patient: "Oliver Brandt", patientId: "P-10369", when: "yesterday", topClass: "SCC", conf: 0.78, risk: "high", by: "Dr. Berg" },
];

export const PATIENTS_SEED = [
  { id: "P-10284", name: "Margaret Chen", age: 62, sex: "F", lastVisit: "2026-04-14", scans: 4, status: "Follow-up", topClass: "NV", risk: "low" as RiskBucket },
  { id: "P-10291", name: "Daniel Reyes", age: 48, sex: "M", lastVisit: "2026-04-12", scans: 2, status: "Urgent", topClass: "MEL", risk: "high" as RiskBucket },
  { id: "P-10302", name: "Priya Shah", age: 34, sex: "F", lastVisit: "2026-04-10", scans: 1, status: "Cleared", topClass: "BKL", risk: "low" as RiskBucket },
  { id: "P-10318", name: "Hassan Nasser", age: 71, sex: "M", lastVisit: "2026-04-08", scans: 6, status: "Follow-up", topClass: "BCC", risk: "high" as RiskBucket },
  { id: "P-10327", name: "Lena Kowalski", age: 29, sex: "F", lastVisit: "2026-04-06", scans: 1, status: "Cleared", topClass: "DF", risk: "low" as RiskBucket },
  { id: "P-10342", name: "Marcus Webb", age: 55, sex: "M", lastVisit: "2026-04-03", scans: 3, status: "Pending", topClass: "AK", risk: "med" as RiskBucket },
  { id: "P-10351", name: "Aisha Dupont", age: 41, sex: "F", lastVisit: "2026-03-30", scans: 2, status: "Follow-up", topClass: "NV", risk: "low" as RiskBucket },
  { id: "P-10369", name: "Oliver Brandt", age: 67, sex: "M", lastVisit: "2026-03-28", scans: 5, status: "Urgent", topClass: "SCC", risk: "high" as RiskBucket },
];
