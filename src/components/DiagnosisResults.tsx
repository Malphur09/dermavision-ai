"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Download,
  FileText,
  Info,
  Mail,
  MoreHorizontal,
  Save,
  Sparkles,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/primitives/PageHeader";
import { Alert } from "@/components/primitives/Alert";
import { Avatar } from "@/components/primitives/Avatar";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

const IMAGES_BUCKET = "dermoscopy-images";

const ISIC_CODE: Record<string, string> = {
  Melanoma: "MEL",
  "Melanocytic Nevus": "NV",
  "Basal Cell Carcinoma": "BCC",
  "Actinic Keratosis": "AK",
  "Benign Keratosis": "BKL",
  Dermatofibroma: "DF",
  "Vascular Lesion": "VASC",
  "Squamous Cell Carcinoma": "SCC",
};

const CLASS_RISK: Record<string, "high" | "moderate" | "benign"> = {
  Melanoma: "high",
  "Squamous Cell Carcinoma": "high",
  "Basal Cell Carcinoma": "high",
  "Actinic Keratosis": "moderate",
  "Melanocytic Nevus": "benign",
  "Benign Keratosis": "benign",
  Dermatofibroma: "benign",
  "Vascular Lesion": "benign",
};

const RISK_META = {
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

const NEXT_STEPS: Record<string, string[]> = {
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

interface CaseSession {
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
}

export function DiagnosisResults() {
  const router = useRouter();
  const [caseData, setCaseData] = useState<CaseSession | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(true);
  const [heatmapDataUrl, setHeatmapDataUrl] = useState<string | null>(null);
  const [heatmapPending, setHeatmapPending] = useState(true);
  const [heatmapOn, setHeatmapOn] = useState(true);
  const [blend, setBlend] = useState(50);

  useEffect(() => {
    const raw = sessionStorage.getItem("lastCase");
    if (!raw) {
      setLoadingImage(false);
      setHeatmapPending(false);
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
    const supabase = createClient();
    supabase.storage
      .from(IMAGES_BUCKET)
      .createSignedUrl(parsed.storagePath, 3600)
      .then(({ data }) => {
        if (data?.signedUrl) setImageUrl(data.signedUrl);
      })
      .finally(() => setLoadingImage(false));
  }, []);

  useEffect(() => {
    if (!heatmapPending) return;
    const interval = setInterval(() => {
      const raw = sessionStorage.getItem("lastCase");
      if (!raw) {
        clearInterval(interval);
        setHeatmapPending(false);
        return;
      }
      const parsed = JSON.parse(raw) as CaseSession;
      if (parsed.heatmapDataUrl) {
        setHeatmapDataUrl(parsed.heatmapDataUrl);
        setHeatmapPending(false);
        clearInterval(interval);
      }
    }, 500);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setHeatmapPending(false);
    }, 30_000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [heatmapPending]);

  const ranked = useMemo(() => {
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

  const top = ranked[0];
  const second = ranked[1];
  const risk = RISK_META[top.risk];
  const isHighRisk = top.risk === "high";
  const nextSteps = NEXT_STEPS[top.code] ?? [];
  const patientLabel =
    caseData.patientLabel ||
    [caseData.patientId, caseData.patientName].filter(Boolean).join(" · ") ||
    "Patient";
  const patientDisplayName = caseData.patientName || patientLabel.split("·").slice(-1)[0].trim();

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
              onClick={() => router.push("/report")}
              title="Generate report"
            >
              <Download size={14} /> Export PDF
            </Button>
            <Button variant="brand" onClick={() => router.push("/records")}>
              <Save size={14} /> View record
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
          />
          <NextStepsCard steps={nextSteps} />
        </div>
      </div>
    </div>
  );
}

function TopPrediction({
  top,
  second,
  risk,
}: {
  top: { name: string; code: string; p: number };
  second?: { p: number };
  risk: (typeof RISK_META)[keyof typeof RISK_META];
}) {
  const margin = second ? (top.p - second.p) * 100 : 0;
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 uppercase tracking-wide mono">
        <Sparkles size={12} /> Top prediction
      </div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight mb-1">
            {top.name}
          </h2>
          <div className="text-sm text-muted-foreground mono">
            ISIC · {top.code}
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded px-3 py-1 text-xs font-medium"
          style={{
            background: risk.bg,
            color: risk.color,
            border: `1px solid ${risk.color}33`,
          }}
        >
          <AlertTriangle size={11} /> {risk.label}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <div
          className="text-5xl font-semibold mono tracking-tight"
          style={{ color: risk.color }}
        >
          {(top.p * 100).toFixed(1)}%
        </div>
        <div className="text-sm text-muted-foreground">confidence</div>
      </div>
      <div
        className="mt-3 rounded-full overflow-hidden"
        style={{ height: 8, background: "hsl(var(--muted))" }}
      >
        <div
          style={{
            height: "100%",
            width: `${top.p * 100}%`,
            background: risk.color,
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <div className="text-xs text-muted-foreground mt-2 mono">
        Margin over 2nd:{" "}
        <span className="font-medium text-foreground">+{margin.toFixed(1)}pp</span>
      </div>
    </div>
  );
}

function ProbBars({
  ranked,
  topColor,
}: {
  ranked: { name: string; code: string; p: number; risk: string }[];
  topColor: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">All 8 class probabilities</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            ISIC 2019 dermatoscopic classes · softmax output
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {ranked.map((c, i) => (
          <div key={c.code} className="flex items-center gap-3">
            <div className="flex-shrink-0 w-5 text-right">
              <span className="text-xs mono text-muted-foreground">{i + 1}</span>
            </div>
            <div style={{ width: 170 }}>
              <div className="text-sm font-medium truncate">{c.name}</div>
              <div className="text-xs mono text-muted-foreground">{c.code}</div>
            </div>
            <div
              className="flex-1 relative rounded overflow-hidden"
              style={{ height: 10, background: "hsl(var(--muted))" }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${c.p * 100}%`,
                  background:
                    i === 0 ? topColor : "hsl(var(--muted-foreground) / 0.4)",
                  transition: "width 0.6s ease",
                }}
              />
            </div>
            <div className="mono text-sm font-medium w-16 text-right">
              {(c.p * 100).toFixed(c.p < 0.01 ? 2 : 1)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImagePanel({
  imageUrl,
  loadingImage,
  heatmapDataUrl,
  heatmapPending,
  heatmapOn,
  setHeatmapOn,
  blend,
  setBlend,
}: {
  imageUrl: string | null;
  loadingImage: boolean;
  heatmapDataUrl: string | null;
  heatmapPending: boolean;
  heatmapOn: boolean;
  setHeatmapOn: (v: boolean) => void;
  blend: number;
  setBlend: (v: number) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">Visual analysis</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Grad-CAM attribution
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Heatmap</span>
          <Switch
            checked={heatmapOn}
            onCheckedChange={setHeatmapOn}
            disabled={!heatmapDataUrl}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ImageSlot label="Original" src={imageUrl} pending={loadingImage} />
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide mono mb-2">
            Grad-CAM overlay
          </div>
          <div
            className="relative aspect-square rounded-md overflow-hidden bg-muted"
            style={{
              borderRadius: "calc(var(--radius) - 2px)",
            }}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Original"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                {loadingImage ? "Loading…" : "Image unavailable"}
              </div>
            )}
            {heatmapDataUrl && heatmapOn && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heatmapDataUrl}
                alt="Grad-CAM overlay"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                style={{ opacity: blend / 100 }}
              />
            )}
            {heatmapPending && (
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] mono px-2 py-1 rounded">
                Generating…
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 pt-5 border-t border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Blend: original ↔ heatmap
          </span>
          <span className="mono text-xs text-muted-foreground">{blend}%</span>
        </div>
        <Slider
          value={[blend]}
          min={0}
          max={100}
          step={1}
          onValueChange={(v) => setBlend(v[0])}
          disabled={!heatmapDataUrl || !heatmapOn}
        />
        <div className="flex items-center justify-between mt-1 text-xs mono text-muted-foreground">
          <span>Original</span>
          <span>50 / 50</span>
          <span>Heatmap</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 p-3 rounded bg-muted/50">
        <Info
          size={14}
          className="text-muted-foreground flex-shrink-0"
        />
        <p className="text-xs text-muted-foreground">
          Warm regions indicate where the model focused attention.
          {/* MOCK: colormap selector + attribution heuristic — backend returns fixed jet overlay */}
        </p>
      </div>
    </div>
  );
}

function ImageSlot({
  label,
  src,
  pending,
}: {
  label: string;
  src: string | null;
  pending?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide mono mb-2">
        {label}
      </div>
      <div className="aspect-square rounded-md overflow-hidden bg-muted flex items-center justify-center">
        {pending ? (
          <span className="text-xs text-muted-foreground">Loading…</span>
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={label}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-xs text-muted-foreground">Unavailable</span>
        )}
      </div>
    </div>
  );
}

function PatientCard({
  name,
  label,
  lesionSite,
}: {
  name: string;
  label: string;
  lesionSite: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <Avatar name={name} size={44} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{name}</div>
          <div className="text-xs text-muted-foreground mono truncate">{label}</div>
        </div>
        <Button variant="ghost" size="icon">
          <MoreHorizontal size={14} />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Site</div>
          <div className="font-medium capitalize">{lesionSite || "—"}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Status</div>
          <div className="font-medium">Awaiting review</div>
        </div>
      </div>
    </div>
  );
}

function NextStepsCard({ steps }: { steps: string[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div
          className="p-1.5 rounded"
          style={{
            background: "hsl(var(--brand) / 0.1)",
            color: "hsl(var(--brand))",
          }}
        >
          <FileText size={14} />
        </div>
        <h3 className="font-semibold">Suggested next steps</h3>
      </div>
      <ol className="flex flex-col gap-2.5">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span
              className="mono text-xs rounded-full flex-shrink-0 flex items-center justify-center font-medium"
              style={{
                width: 20,
                height: 20,
                background: "hsl(var(--brand) / 0.12)",
                color: "hsl(var(--brand))",
                marginTop: 1,
              }}
            >
              {i + 1}
            </span>
            <span className="leading-relaxed">{s}</span>
          </li>
        ))}
      </ol>
      <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 flex-wrap">
        {/* MOCK: referral letter + send to patient actions */}
        <Button variant="outline" size="sm">
          <FileText size={12} /> Referral letter
        </Button>
        <Button variant="outline" size="sm">
          <Mail size={12} /> Send to patient
        </Button>
      </div>
    </div>
  );
}
