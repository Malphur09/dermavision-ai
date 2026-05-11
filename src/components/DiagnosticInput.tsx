"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle,
  Clock,
  Image as ImageIcon,
  Lock,
  Plus,
  Shield,
  Sparkles,
  Upload as UploadIcon,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/primitives/PageHeader";
import { Alert } from "@/components/primitives/Alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

const IMAGES_BUCKET = "dermoscopic-images";
const HEATMAPS_BUCKET = "heatmaps";

const RISK_LEVEL: Record<string, "High Risk" | "Moderate Risk" | "Benign"> = {
  Melanoma: "High Risk",
  "Squamous Cell Carcinoma": "High Risk",
  "Basal Cell Carcinoma": "High Risk",
  "Actinic Keratosis": "Moderate Risk",
  "Melanocytic Nevus": "Benign",
  "Benign Keratosis": "Benign",
  Dermatofibroma: "Benign",
  "Vascular Lesion": "Benign",
};

const ANATOMICAL_SITES = [
  "back",
  "arm",
  "leg",
  "face",
  "chest",
  "abdomen",
  "hand",
  "foot",
];

type Patient = {
  id: string;
  patient_id: string;
  name: string;
  age: number | null;
  sex: string | null;
};

type Step = "select" | "uploading" | "ready";

interface DiagnosticInputProps {
  onNavigateToResults: () => void;
}

export function DiagnosticInput({ onNavigateToResults }: DiagnosticInputProps) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const startInNewPatient = searchParams?.get("new") === "1";

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientDbId, setSelectedPatientDbId] = useState<string>("");
  const [isNewPatient, setIsNewPatient] = useState(startInNewPatient);

  const [newPatientId, setNewPatientId] = useState("");
  const [newPatientName, setNewPatientName] = useState("");
  const [newAge, setNewAge] = useState("");
  const [newSex, setNewSex] = useState("");

  const [lesionSite, setLesionSite] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");

  const [step, setStep] = useState<Step>("select");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const supabase = createClient();
      const { data } = await supabase
        .from("patients")
        .select("id,patient_id,name,age,sex")
        .order("name");
      if (data) setPatients(data);
    };
    load();
  }, [user]);

  useEffect(() => {
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, []);

  const clearErr = (field: string) => {
    if (errors[field]) {
      setErrors((p) => {
        const n = { ...p };
        delete n[field];
        return n;
      });
    }
  };

  const validateAndSetFile = useCallback((file: File) => {
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      toast.error("Invalid file type. JPEG or PNG only.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File exceeds 10MB limit");
      return;
    }
    if (file.size < 10 * 1024) {
      toast.error("File too small");
      return;
    }
    setUploadedFile(file);
    simulateUpload();
  }, []);

  const simulateUpload = () => {
    setStep("uploading");
    setProgress(0);
    let p = 0;
    if (progressTimer.current) clearInterval(progressTimer.current);
    progressTimer.current = setInterval(() => {
      p += 8 + Math.random() * 10;
      if (p >= 100) {
        setProgress(100);
        if (progressTimer.current) clearInterval(progressTimer.current);
        setTimeout(() => setStep("ready"), 300);
      } else {
        setProgress(p);
      }
    }, 140);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSetFile(file);
  };

  const openFileDialog = () => fileInputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSetFile(file);
  };

  const resetUpload = () => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    setUploadedFile(null);
    setProgress(0);
    setStep("select");
  };

  const validateCase = () => {
    const next: Record<string, string> = {};
    if (!lesionSite) next.lesionSite = "Anatomical site is required";
    if (isNewPatient) {
      const currentYear = new Date().getFullYear();
      if (!newPatientId.trim()) next.newPatientId = "Patient ID is required";
      else {
        const m = newPatientId.trim().match(/^PT-(\d{4})-(\d{3,})$/i);
        if (!m) {
          next.newPatientId = `Format: PT-${currentYear}-001`;
        } else if (parseInt(m[1], 10) < currentYear) {
          next.newPatientId = `Year must be ${currentYear} or later`;
        }
      }
      if (!newPatientName.trim()) next.newPatientName = "Name is required";
      if (!newAge.trim()) next.newAge = "Age is required";
      else {
        const a = parseInt(newAge);
        if (Number.isNaN(a) || a < 0 || a > 120) next.newAge = "0–120";
      }
      if (!newSex) next.newSex = "Sex is required";
    } else if (!selectedPatientDbId) {
      next.patient = "Select a patient";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const ensurePatient = async (): Promise<{
    id: string;
    label: string;
  } | null> => {
    if (!user) return null;
    const supabase = createClient();

    if (!isNewPatient) {
      const p = patients.find((x) => x.id === selectedPatientDbId);
      if (!p) return null;
      return { id: p.id, label: `${p.patient_id} · ${p.name}` };
    }

    const normalizedId = newPatientId.trim().toUpperCase();
    const { data: existing } = await supabase
      .from("patients")
      .select("id")
      .eq("patient_id", normalizedId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("patients")
        .update({
          name: newPatientName.trim(),
          age: parseInt(newAge),
          sex: newSex,
        })
        .eq("id", existing.id);
      return {
        id: existing.id,
        label: `${normalizedId} · ${newPatientName.trim()}`,
      };
    }

    const { data: created, error } = await supabase
      .from("patients")
      .insert({
        patient_id: normalizedId,
        name: newPatientName.trim(),
        age: parseInt(newAge),
        sex: newSex,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) {
      toast.error("Patient ID already in use");
      return null;
    }
    return { id: created.id, label: `${normalizedId} · ${newPatientName.trim()}` };
  };

  const runAnalysis = async () => {
    if (!uploadedFile || step !== "ready") {
      toast.error("Upload an image first");
      return;
    }
    if (!validateCase()) {
      toast.error("Complete case details before processing");
      return;
    }
    setIsProcessing(true);
    const patientInfo = await ensurePatient();
    if (!patientInfo) {
      setIsProcessing(false);
      return;
    }

    const supabase = createClient();
    const formData = new FormData();
    formData.append("file", uploadedFile);
    let prediction: {
      predicted_class: string;
      probabilities: Record<string, number>;
    };
    const predictController = new AbortController();
    const predictTimeout = setTimeout(() => predictController.abort(), 60_000);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? null;
      const res = await fetch("/api/predict", {
        method: "POST",
        body: formData,
        signal: predictController.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 429) {
        toast.error("Too many requests — slow down for a minute");
        setIsProcessing(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      prediction = await res.json();
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      toast.error(aborted ? "Prediction timed out" : "Prediction API failed");
      setIsProcessing(false);
      return;
    } finally {
      clearTimeout(predictTimeout);
    }

    const ext = uploadedFile.name.split(".").pop() ?? "jpg";
    const storagePath = `${user!.id}/${Date.now()}.${ext}`;
    const uploadPromise = supabase.storage
      .from(IMAGES_BUCKET)
      .upload(storagePath, uploadedFile);
    const uploadTimeout = new Promise<{ error: Error }>((resolve) =>
      setTimeout(
        () => resolve({ error: new Error("Image upload timed out") }),
        30_000
      )
    );
    const uploadResult = (await Promise.race([
      uploadPromise,
      uploadTimeout,
    ])) as { error: { message?: string } | null };
    if (uploadResult.error) {
      toast.error(uploadResult.error.message ?? "Image upload failed");
      setIsProcessing(false);
      return;
    }

    const riskLevel = RISK_LEVEL[prediction.predicted_class] ?? "Benign";
    const rawConf = prediction.probabilities[prediction.predicted_class];
    const confidence =
      rawConf != null ? Math.round(rawConf * 10000) / 100 : null;

    const { data: newCase, error: caseError } = await supabase
      .from("cases")
      .insert({
        patient_id: patientInfo.id,
        doctor_id: user!.id,
        lesion_site: lesionSite,
        image_url: storagePath,
        predicted_class: prediction.predicted_class,
        confidence,
        probabilities: prediction.probabilities,
        risk_level: riskLevel,
        status: "complete",
        notes: clinicalNotes || null,
      })
      .select()
      .single();
    if (caseError) {
      toast.error("Failed to save case");
      setIsProcessing(false);
      return;
    }

    sessionStorage.setItem(
      "lastCase",
      JSON.stringify({
        caseId: newCase.id,
        patientLabel: patientInfo.label,
        predictedClass: prediction.predicted_class,
        probabilities: prediction.probabilities,
        confidence,
        riskLevel,
        lesionSite,
        storagePath,
        heatmapDataUrl: null,
      })
    );

    toast.success("Classification complete");
    setIsProcessing(false);
    onNavigateToResults();

    void (async () => {
      try {
        const camForm = new FormData();
        camForm.append("file", uploadedFile);
        const { data: camSession } = await supabase.auth.getSession();
        const camToken = camSession.session?.access_token ?? null;
        const camRes = await fetch("/api/gradcam", {
          method: "POST",
          body: camForm,
          headers: camToken ? { Authorization: `Bearer ${camToken}` } : {},
        });
        if (!camRes.ok) {
          toast.warning(`Heatmap unavailable (HTTP ${camRes.status})`);
          return;
        }
        const camData: { heatmap: string | null; message?: string } = await camRes.json();
        if (!camData.heatmap) {
          toast.warning(camData.message ?? "Heatmap unavailable");
          return;
        }

        const stored = sessionStorage.getItem("lastCase");
        if (stored) {
          sessionStorage.setItem(
            "lastCase",
            JSON.stringify({
              ...JSON.parse(stored),
              heatmapDataUrl: camData.heatmap,
            })
          );
        }

        // Persist heatmap to storage so it survives page refresh + is available
        // for audit/review. Heatmap arrives as a base64 data URL; convert to blob.
        const blob = await (await fetch(camData.heatmap)).blob();
        const heatmapPath = `${user!.id}/${newCase.id}.png`;
        const { error: hmUploadErr } = await supabase.storage
          .from(HEATMAPS_BUCKET)
          .upload(heatmapPath, blob, {
            contentType: "image/png",
            upsert: true,
          });
        if (hmUploadErr) {
          toast.warning(`Heatmap upload failed: ${hmUploadErr.message}`);
          return;
        }
        await supabase
          .from("cases")
          .update({ gradcam_url: heatmapPath })
          .eq("id", newCase.id);
      } catch (e) {
        toast.warning(`Heatmap pipeline error: ${e instanceof Error ? e.message : "unknown"}`);
      }
    })();
  };

  const selectedPatient = patients.find((p) => p.id === selectedPatientDbId);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Upload dermatoscope image"
        subtitle="Drop a JPG or PNG. Images are encrypted in transit."
        breadcrumb={["Doctor", "New scan"]}
      />

      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 320px" }}>
        <div className="rounded-lg border border-border bg-card p-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={onFileChange}
            className="hidden"
          />

          {step === "select" && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={openFileDialog}
              className="flex flex-col items-center justify-center rounded-md cursor-pointer transition"
              style={{
                border: `2px dashed ${
                  dragging ? "hsl(var(--brand))" : "hsl(var(--border))"
                }`,
                background: dragging
                  ? "hsl(var(--brand) / 0.05)"
                  : "hsl(var(--muted) / 0.3)",
                minHeight: 360,
                padding: 40,
                textAlign: "center",
              }}
            >
              <div
                className="p-4 rounded-full mb-4"
                style={{
                  background: "hsl(var(--brand) / 0.1)",
                  color: "hsl(var(--brand))",
                }}
              >
                <UploadIcon size={28} />
              </div>
              <h3 className="text-lg font-semibold mb-1">Drop image here</h3>
              <p className="text-sm text-muted-foreground mb-6">
                or click to browse · JPG, PNG · max 10 MB
              </p>
              <div className="flex items-center gap-2">
                <Button variant="brand" type="button">
                  <ImageIcon size={14} /> Choose file
                </Button>
              </div>
              <div className="flex items-center gap-6 mt-8 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Shield size={12} /> HIPAA encrypted
                </div>
                <div className="flex items-center gap-1.5">
                  <Lock size={12} /> Private to clinic
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={12} /> ~340ms inference
                </div>
              </div>
            </div>
          )}

          {step === "uploading" && (
            <div
              className="flex flex-col items-center justify-center"
              style={{ minHeight: 360 }}
            >
              <div className="w-full max-w-md">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium truncate mr-2">
                    {uploadedFile?.name}
                  </span>
                  <span className="mono text-muted-foreground">
                    {Math.floor(progress)}%
                  </span>
                </div>
                <Progress value={progress} />
                <div className="text-xs text-muted-foreground mt-2 mono">
                  {progress < 50
                    ? "Uploading…"
                    : progress < 95
                      ? "Preprocessing · normalizing"
                      : "Ready for inference…"}
                </div>
              </div>
            </div>
          )}

          {step === "ready" && uploadedFile && (
            <div
              className="flex flex-col items-center justify-center"
              style={{ minHeight: 360 }}
            >
              <div className="flex items-center gap-2 text-sm mb-4">
                <CheckCircle size={16} style={{ color: "hsl(var(--success))" }} />
                <span className="font-medium">
                  {uploadedFile.name} · {(uploadedFile.size / 1024).toFixed(1)}{" "}
                  KB
                </span>
              </div>
              <div className="text-xs text-muted-foreground mb-6">
                Ready to analyze
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="brand"
                  size="lg"
                  onClick={runAnalysis}
                  disabled={isProcessing}
                >
                  <Sparkles size={14} />{" "}
                  {isProcessing ? "Running analysis…" : "Run analysis"}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={resetUpload}
                  disabled={isProcessing}
                >
                  Replace image
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-semibold mb-4">Case details</h3>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>Patient</Label>
                <button
                  type="button"
                  onClick={() => {
                    setIsNewPatient((p) => !p);
                    clearErr("patient");
                  }}
                  className="text-xs text-brand inline-flex items-center gap-1"
                >
                  <Plus size={10} />
                  {isNewPatient ? "Use existing" : "New patient"}
                </button>
              </div>

              {!isNewPatient ? (
                <>
                  <Select
                    value={selectedPatientDbId}
                    onValueChange={(v) => {
                      setSelectedPatientDbId(v);
                      clearErr("patient");
                    }}
                  >
                    <SelectTrigger
                      aria-invalid={!!errors.patient}
                      className="w-full"
                    >
                      <SelectValue placeholder="Select patient" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.length === 0 && (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          No patients yet
                        </div>
                      )}
                      {patients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} · {p.patient_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPatient && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>
                        {selectedPatient.age ?? "—"} ·{" "}
                        {selectedPatient.sex ?? "—"}
                      </span>
                    </div>
                  )}
                  {errors.patient && (
                    <p className="mt-1 text-xs text-destructive">
                      {errors.patient}
                    </p>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="np-id" className="text-xs">
                      Patient ID
                    </Label>
                    <Input
                      id="np-id"
                      placeholder={`PT-${new Date().getFullYear()}-001`}
                      value={newPatientId}
                      onChange={(e) => {
                        setNewPatientId(e.target.value);
                        clearErr("newPatientId");
                      }}
                      aria-invalid={!!errors.newPatientId}
                      className="mt-1"
                    />
                    {errors.newPatientId && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.newPatientId}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="np-name" className="text-xs">
                      Name
                    </Label>
                    <Input
                      id="np-name"
                      value={newPatientName}
                      onChange={(e) => {
                        setNewPatientName(e.target.value);
                        clearErr("newPatientName");
                      }}
                      aria-invalid={!!errors.newPatientName}
                      className="mt-1"
                    />
                    {errors.newPatientName && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.newPatientName}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="np-age" className="text-xs">
                        Age
                      </Label>
                      <Input
                        id="np-age"
                        type="number"
                        value={newAge}
                        onChange={(e) => {
                          setNewAge(e.target.value);
                          clearErr("newAge");
                        }}
                        aria-invalid={!!errors.newAge}
                        className="mt-1"
                      />
                      {errors.newAge && (
                        <p className="mt-1 text-xs text-destructive">
                          {errors.newAge}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">Sex</Label>
                      <Select
                        value={newSex}
                        onValueChange={(v) => {
                          setNewSex(v);
                          clearErr("newSex");
                        }}
                      >
                        <SelectTrigger
                          aria-invalid={!!errors.newSex}
                          className="mt-1 w-full"
                        >
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.newSex && (
                        <p className="mt-1 text-xs text-destructive">
                          {errors.newSex}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label>Anatomical site</Label>
              <Select
                value={lesionSite}
                onValueChange={(v) => {
                  setLesionSite(v);
                  clearErr("lesionSite");
                }}
              >
                <SelectTrigger
                  aria-invalid={!!errors.lesionSite}
                  className="mt-1 w-full"
                >
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {ANATOMICAL_SITES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s[0].toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.lesionSite && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.lesionSite}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="notes">Clinical notes</Label>
              <Textarea
                id="notes"
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Any relevant history or observations…"
                className="mt-1 h-20 resize-y"
              />
            </div>

            <Alert variant="info" title="Decision support only">
              <span className="text-xs">
                All predictions require clinician review and are not a
                diagnosis.
              </span>
            </Alert>
          </div>
        </div>
      </div>
    </div>
  );
}
