"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, Check, Download } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { logPhiAccess } from "@/lib/audit";
import { PageHeader } from "@/components/primitives/PageHeader";
import { Alert } from "@/components/primitives/Alert";
import { Button } from "@/components/ui/button";

import {
  CLASS_RISK,
  ISIC_CODE,
  NEXT_STEPS,
  RISK_META,
  type CaseSession,
  type RankedClass,
} from "@/components/results/constants";
import { ImagePanel } from "@/components/results/ImagePanel";
import { NextStepsCard } from "@/components/results/NextStepsCard";
import { NotesCard } from "@/components/results/NotesCard";
import { PatientCard } from "@/components/results/PatientCard";
import { ProbBars } from "@/components/results/ProbBars";
import { TopPrediction } from "@/components/results/TopPrediction";

const IMAGES_BUCKET = "dermoscopic-images";
const HEATMAPS_BUCKET = "heatmaps";

export function DiagnosisResults() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramCaseId = searchParams.get("caseId");
  const [caseData, setCaseData] = useState<CaseSession | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(true);
  const [heatmapDataUrl, setHeatmapDataUrl] = useState<string | null>(null);
  const [heatmapPending, setHeatmapPending] = useState(true);
  const [heatmapOn, setHeatmapOn] = useState(true);
  const [blend, setBlend] = useState(50);
  const [status, setStatus] = useState<string>("pending");
  const [notes, setNotes] = useState<string>("");
  const [initialNotes, setInitialNotes] = useState<string>("");
  const [savingReview, setSavingReview] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const hydrateFromRow = async (row: {
      id: string;
      image_url: string | null;
      gradcam_url: string | null;
      predicted_class: string | null;
      probabilities: Record<string, number> | null;
      confidence: number | null;
      risk_level: string | null;
      lesion_site: string | null;
      status: string | null;
      notes: string | null;
      patients: { patient_id: string | null; name: string | null } | null;
    }) => {
      const patientId = row.patients?.patient_id ?? undefined;
      const patientName = row.patients?.name ?? undefined;
      const parsed: CaseSession = {
        caseId: row.id,
        patientId,
        patientName,
        patientLabel: [patientId, patientName].filter(Boolean).join(" · "),
        predictedClass: row.predicted_class ?? "Unknown",
        probabilities: row.probabilities ?? {},
        confidence: row.confidence,
        riskLevel: row.risk_level ?? "Benign",
        lesionSite: row.lesion_site ?? "",
        storagePath: row.image_url ?? "",
        heatmapDataUrl: null,
        status: row.status ?? "pending",
        notes: row.notes,
      };
      setCaseData(parsed);
      setStatus(parsed.status ?? "pending");
      setNotes(parsed.notes ?? "");
      setInitialNotes(parsed.notes ?? "");

      if (parsed.storagePath) {
        const { data: signed } = await supabase.storage
          .from(IMAGES_BUCKET)
          .createSignedUrl(parsed.storagePath, 3600);
        if (signed?.signedUrl) setImageUrl(signed.signedUrl);
      }
      setLoadingImage(false);

      if (row.gradcam_url) {
        const { data: signed } = await supabase.storage
          .from(HEATMAPS_BUCKET)
          .createSignedUrl(row.gradcam_url, 3600);
        if (signed?.signedUrl) {
          setHeatmapDataUrl(signed.signedUrl);
          setHeatmapPending(false);
        }
      } else {
        setHeatmapPending(false);
      }

      void logPhiAccess({
        resource_type: "case",
        resource_id: parsed.caseId,
        action: "viewed",
      });
    };

    const loadById = async (id: string) => {
      const { data, error } = await supabase
        .from("cases")
        .select(
          "id, image_url, gradcam_url, predicted_class, probabilities, confidence, risk_level, lesion_site, status, notes, patients(patient_id, name)"
        )
        .eq("id", id)
        .maybeSingle();
      if (error || !data) {
        setLoadingImage(false);
        setHeatmapPending(false);
        return;
      }
      const row = data as unknown as Parameters<typeof hydrateFromRow>[0];
      await hydrateFromRow(row);
    };

    if (paramCaseId) {
      void loadById(paramCaseId);
      return;
    }

    const raw = sessionStorage.getItem("lastCase");
    if (!raw) {
      // No fresh scan in this session — fall back to the most recent case
      // for the current user. RLS on `cases` limits the query to the
      // caller's own rows (admins could also hit this path but the page is
      // doctor-oriented).
      const loadLatest = async () => {
        const { data, error } = await supabase
          .from("cases")
          .select(
            "id, image_url, gradcam_url, predicted_class, probabilities, confidence, risk_level, lesion_site, status, notes, patients(patient_id, name)"
          )
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error || !data) {
          setLoadingImage(false);
          setHeatmapPending(false);
          return;
        }
        const row = data as unknown as Parameters<typeof hydrateFromRow>[0];
        await hydrateFromRow(row);
      };
      void loadLatest();
      return;
    }
    let parsed: CaseSession;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setLoadingImage(false);
      setHeatmapPending(false);
      return;
    }
    setCaseData(parsed);
    if (parsed.heatmapDataUrl) {
      setHeatmapDataUrl(parsed.heatmapDataUrl);
      setHeatmapPending(false);
    }
    supabase.storage
      .from(IMAGES_BUCKET)
      .createSignedUrl(parsed.storagePath, 3600)
      .then(({ data }) => {
        if (data?.signedUrl) setImageUrl(data.signedUrl);
      })
      .finally(() => setLoadingImage(false));

    supabase
      .from("cases")
      .select("gradcam_url, status, notes")
      .eq("id", parsed.caseId)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) return;
        if (data.status) setStatus(data.status);
        if (typeof data.notes === "string") {
          setNotes(data.notes);
          setInitialNotes(data.notes);
        }
        if (data.gradcam_url) {
          const { data: signed } = await supabase.storage
            .from(HEATMAPS_BUCKET)
            .createSignedUrl(data.gradcam_url, 3600);
          if (signed?.signedUrl) {
            setHeatmapDataUrl(signed.signedUrl);
            setHeatmapPending(false);
          }
        }
      });

    void logPhiAccess({
      resource_type: "case",
      resource_id: parsed.caseId,
      action: "viewed",
    });
  }, [paramCaseId]);

  const handleMarkReviewed = async () => {
    if (!caseData || status === "reviewed" || status === "complete") return;
    setSavingReview(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("cases")
      .update({ status: "reviewed" })
      .eq("id", caseData.caseId);
    setSavingReview(false);
    if (error) {
      toast.error("Failed to mark reviewed");
      return;
    }
    setStatus("reviewed");
    toast.success("Case marked as reviewed");
    void logPhiAccess({
      resource_type: "case",
      resource_id: caseData.caseId,
      action: "reviewed",
    });
  };

  const handleSaveNotes = async () => {
    if (!caseData || notes === initialNotes || savingNotes) return;
    setSavingNotes(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("cases")
      .update({ notes })
      .eq("id", caseData.caseId);
    setSavingNotes(false);
    if (error) {
      toast.error("Failed to save notes");
      return;
    }
    setInitialNotes(notes);
    toast.success("Notes saved");
  };

  useEffect(() => {
    if (!heatmapPending || !caseData) return;
    const supabase = createClient();
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("cases")
        .select("gradcam_url")
        .eq("id", caseData.caseId)
        .maybeSingle();
      if (data?.gradcam_url) {
        const { data: signed } = await supabase.storage
          .from(HEATMAPS_BUCKET)
          .createSignedUrl(data.gradcam_url, 3600);
        if (signed?.signedUrl) {
          setHeatmapDataUrl(signed.signedUrl);
          setHeatmapPending(false);
          clearInterval(interval);
        }
      }
    }, 1500);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setHeatmapPending(false);
      toast.warning("Heatmap unavailable — generation timed out");
    }, 30_000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [heatmapPending, caseData]);

  const ranked = useMemo<RankedClass[]>(() => {
    if (!caseData) return [];
    return Object.entries(caseData.probabilities)
      .map(([cls, p]) => ({
        name: cls,
        code: ISIC_CODE[cls] ?? cls,
        p,
        risk: CLASS_RISK[cls] ?? "benign",
      }))
      .sort((a, b) => b.p - a.p);
  }, [caseData]);

  if (!caseData) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">
            No case data found. Run a diagnosis first.
          </p>
          <Button variant="brand" onClick={() => router.push("/diagnostic")}>
            Go to diagnostic
          </Button>
        </div>
      </div>
    );
  }

  if (ranked.length === 0) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">
            Case missing class probabilities — rerun prediction.
          </p>
          <Button variant="brand" onClick={() => router.push("/diagnostic")}>
            New scan
          </Button>
        </div>
      </div>
    );
  }

  const top = ranked[0];
  const second = ranked[1];
  const risk = RISK_META[top.risk];
  const isHighRisk = top.risk === "high";
  const nextSteps = NEXT_STEPS[top.code] ?? [];
  const patientLabel =
    caseData.patientLabel ||
    [caseData.patientId, caseData.patientName].filter(Boolean).join(" · ") ||
    "Patient";
  const patientDisplayName =
    caseData.patientName || patientLabel.split("·").slice(-1)[0].trim();

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Analysis results"
        subtitle={`Case ${caseData.caseId.slice(0, 8)} · ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`}
        breadcrumb={["Doctor", "Results"]}
        actions={
          <>
            <Button variant="outline" onClick={() => router.push("/diagnostic")}>
              <ArrowLeft size={14} /> New scan
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/report?caseId=${caseData.caseId}`)}
              title="Generate report"
            >
              <Download size={14} /> Export PDF
            </Button>
            <Button
              variant="brand"
              onClick={handleMarkReviewed}
              disabled={
                savingReview || status === "reviewed" || status === "complete"
              }
            >
              <Check size={14} />
              {status === "reviewed" || status === "complete"
                ? "Reviewed"
                : savingReview
                  ? "Saving…"
                  : "Mark reviewed"}
            </Button>
          </>
        }
      />

      {isHighRisk && (
        <div className="mb-5">
          <Alert
            variant="danger"
            title="High-risk prediction — clinical review recommended"
          >
            Confidence{" "}
            <strong>
              {(top.p * 100).toFixed(1)}% for {top.name}
            </strong>
            . Expedite referral and biopsy per guidance below.
          </Alert>
        </div>
      )}

      <div className="grid gap-5" style={{ gridTemplateColumns: "1.3fr 1fr" }}>
        <div className="flex flex-col gap-5">
          <ImagePanel
            imageUrl={imageUrl}
            loadingImage={loadingImage}
            heatmapDataUrl={heatmapDataUrl}
            heatmapPending={heatmapPending}
            heatmapOn={heatmapOn}
            setHeatmapOn={setHeatmapOn}
            blend={blend}
            setBlend={setBlend}
          />
          <ProbBars ranked={ranked} topColor={risk.color} />
        </div>
        <div className="flex flex-col gap-5">
          <TopPrediction top={top} second={second} risk={risk} />
          <PatientCard
            name={patientDisplayName}
            label={patientLabel}
            lesionSite={caseData.lesionSite}
            status={status}
          />
          <NextStepsCard steps={nextSteps} />
          <NotesCard
            notes={notes}
            setNotes={setNotes}
            onSave={handleSaveNotes}
            saving={savingNotes}
            dirty={notes !== initialNotes}
          />
        </div>
      </div>
    </div>
  );
}
