export const RISK_LEVEL: Record<string, "High Risk" | "Moderate Risk" | "Benign"> = {
  Melanoma: "High Risk",
  "Squamous Cell Carcinoma": "High Risk",
  "Basal Cell Carcinoma": "High Risk",
  "Actinic Keratosis": "Moderate Risk",
  "Melanocytic Nevus": "Benign",
  "Benign Keratosis": "Benign",
  Dermatofibroma: "Benign",
  "Vascular Lesion": "Benign",
};

export const ANATOMICAL_SITES = [
  "back",
  "arm",
  "leg",
  "face",
  "chest",
  "abdomen",
  "hand",
  "foot",
];

export type Patient = {
  id: string;
  patient_id: string;
  name: string;
  age: number | null;
  sex: string | null;
};

export type Step = "select" | "uploading" | "ready";
