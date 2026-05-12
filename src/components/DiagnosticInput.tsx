"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/primitives/PageHeader";

import {
  RISK_LEVEL,
  type Patient,
  type Step,
} from "@/components/diagnostic/constants";
import { CaseDetailsSidebar } from "@/components/diagnostic/CaseDetailsSidebar";
import { UploadDropzone } from "@/components/diagnostic/UploadDropzone";

const IMAGES_BUCKET = "dermoscopic-images";
const HEATMAPS_BUCKET = "heatmaps";

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
        toast.warning(
          `Heatmap pipeline error: ${e instanceof Error ? e.message : "unknown"}`
        );
      }
    })();
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Upload dermatoscope image"
        subtitle="Drop a JPG or PNG. Images are encrypted in transit."
        breadcrumb={["Doctor", "New scan"]}
      />

      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 320px" }}>
        <UploadDropzone
          step={step}
          uploadedFile={uploadedFile}
          progress={progress}
          dragging={dragging}
          isProcessing={isProcessing}
          fileInputRef={fileInputRef}
          onFileChange={onFileChange}
          onDrop={onDrop}
          setDragging={setDragging}
          openFileDialog={openFileDialog}
          runAnalysis={runAnalysis}
          resetUpload={resetUpload}
        />

        <CaseDetailsSidebar
          patients={patients}
          isNewPatient={isNewPatient}
          setIsNewPatient={setIsNewPatient}
          selectedPatientDbId={selectedPatientDbId}
          setSelectedPatientDbId={setSelectedPatientDbId}
          newPatientId={newPatientId}
          setNewPatientId={setNewPatientId}
          newPatientName={newPatientName}
          setNewPatientName={setNewPatientName}
          newAge={newAge}
          setNewAge={setNewAge}
          newSex={newSex}
          setNewSex={setNewSex}
          lesionSite={lesionSite}
          setLesionSite={setLesionSite}
          clinicalNotes={clinicalNotes}
          setClinicalNotes={setClinicalNotes}
          errors={errors}
          clearErr={clearErr}
        />
      </div>
    </div>
  );
}
