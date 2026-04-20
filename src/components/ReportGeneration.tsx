"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Download,
  Eye,
  FileJson,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/primitives/PageHeader";
import { Alert } from "@/components/primitives/Alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface CaseSession {
  caseId: string;
  patientLabel?: string;
  patientId?: string;
  patientName?: string;
  predictedClass: string;
  confidence: number | null;
  riskLevel: string;
}

const SECTIONS = [
  {
    key: "patientInfo",
    label: "Patient demographics",
    desc: "Patient ID, age, sex, lesion site",
  },
  {
    key: "diagnosisResults",
    label: "Diagnosis results",
    desc: "Prediction, probabilities, confidence",
  },
  {
    key: "gradCAM",
    label: "Grad-CAM visualization",
    desc: "Heatmap overlay showing model attention",
  },
  {
    key: "recommendations",
    label: "Recommendations",
    desc: "Class-specific clinical next steps",
  },
  {
    key: "technicalDetails",
    label: "Technical details",
    desc: "Model version, inference time, metrics",
  },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const RISK_COLOR: Record<string, string> = {
  "High Risk": "hsl(var(--destructive))",
  "Moderate Risk": "hsl(var(--warning))",
  Benign: "hsl(var(--success))",
};

export function ReportGeneration() {
  const { user } = useAuth();
  const router = useRouter();
  const [caseData, setCaseData] = useState<CaseSession | null>(null);
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({
    patientInfo: true,
    diagnosisResults: true,
    gradCAM: true,
    recommendations: true,
    technicalDetails: false,
  });
  const [format, setFormat] = useState<"pdf" | "json">("pdf");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("lastCase");
    if (raw) {
      try {
        setCaseData(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    }
  }, []);

  const toggle = (k: SectionKey) =>
    setSections((p) => ({ ...p, [k]: !p[k] }));

  const hasAnySection = Object.values(sections).some(Boolean);

  const handlePreview = () => {
    if (!hasAnySection) {
      toast.error("Select at least one section");
      return;
    }
    // MOCK: preview
    toast.info("Preview coming soon");
  };

  const handleExport = async () => {
    if (!hasAnySection) {
      toast.error("Select at least one section");
      return;
    }
    if (!caseData || !user) {
      toast.error("No case loaded. Run a diagnosis first.");
      return;
    }
    setIsGenerating(true);
    const toastId = toast.loading(
      `Generating ${format.toUpperCase()} report…`
    );
    const supabase = createClient();
    const { error } = await supabase.from("reports").insert({
      case_id: caseData.caseId,
      doctor_id: user.id,
      sections,
      format,
    });
    toast.dismiss(toastId);
    if (error) toast.error("Failed to save report");
    else toast.success(`Report saved as ${format.toUpperCase()}`);
    setIsGenerating(false);
  };

  const patientLabel =
    caseData?.patientLabel ||
    [caseData?.patientId, caseData?.patientName].filter(Boolean).join(" · ") ||
    "—";
  const diagnosisLabel = caseData
    ? `${caseData.predictedClass}${caseData.confidence != null ? ` (${caseData.confidence.toFixed(1)}%)` : ""}`
    : "—";
  const sectionCount = Object.values(sections).filter(Boolean).length + 1;
  const riskColor = caseData?.riskLevel
    ? RISK_COLOR[caseData.riskLevel]
    : "hsl(var(--muted-foreground))";

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Export diagnostic report"
        subtitle="Configure sections and generate a signed clinical report."
        breadcrumb={["Doctor", "Reports"]}
      />

      {!caseData && (
        <div className="mb-5">
          <Alert variant="warning" title="No case loaded">
            <button
              onClick={() => router.push("/diagnostic")}
              className="underline font-medium text-foreground"
            >
              Run a diagnosis first
            </button>{" "}
            to populate the report.
          </Alert>
        </div>
      )}

      {caseData && (
        <div
          className="mb-5 rounded-lg border p-4 flex items-center gap-3"
          style={{
            borderColor: `${riskColor}33`,
            background: `${riskColor.replace(")", " / 0.08)")}`,
          }}
        >
          <AlertTriangle size={18} style={{ color: riskColor }} />
          <div className="flex-1">
            <div className="text-sm font-medium">
              {caseData.predictedClass} ·{" "}
              <span style={{ color: riskColor }}>{caseData.riskLevel}</span>
            </div>
            <div className="text-xs text-muted-foreground mono">
              {patientLabel} · case {caseData.caseId.slice(0, 8)}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5">
        <div className="rounded-lg border border-border bg-card">
          <div className="p-5 border-b border-border">
            <h2 className="font-semibold">Report content</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose sections to include
            </p>
          </div>
          <div className="p-5 flex flex-col gap-3">
            {SECTIONS.map(({ key, label, desc }) => (
              <label
                key={key}
                htmlFor={key}
                className="flex items-start gap-3 p-3 rounded-md border border-border hover:bg-muted/40 cursor-pointer transition"
              >
                <Checkbox
                  id={key}
                  checked={sections[key]}
                  onCheckedChange={() => toggle(key)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {desc}
                  </div>
                </div>
              </label>
            ))}
            <div className="flex items-start gap-3 p-3 rounded-md border border-border bg-muted/40">
              <Checkbox checked disabled className="mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-muted-foreground">
                  Clinical disclaimer (required)
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  AI-assisted diagnosis requires clinician confirmation.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="p-5 border-b border-border">
            <h2 className="font-semibold">Export format</h2>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            {(["pdf", "json"] as const).map((fmt) => {
              const active = format === fmt;
              const Icon = fmt === "pdf" ? FileText : FileJson;
              return (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  className="flex items-start gap-3 p-4 border-2 rounded-md text-left transition"
                  style={{
                    borderColor: active
                      ? "hsl(var(--brand))"
                      : "hsl(var(--border))",
                    background: active ? "hsl(var(--brand) / 0.05)" : undefined,
                  }}
                >
                  <Icon
                    size={24}
                    className={active ? "text-brand" : "text-muted-foreground"}
                  />
                  <div className="flex-1">
                    <h3
                      className={`font-medium mb-0.5 ${active ? "text-brand" : ""}`}
                    >
                      {fmt === "pdf" ? "PDF document" : "JSON data"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {fmt === "pdf"
                        ? "Formatted report for clinical records"
                        : "Machine-readable format for EMR integration"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="p-5 border-b border-border">
            <h2 className="font-semibold">Report summary</h2>
          </div>
          <div className="p-5">
            <div className="flex flex-col mb-5">
              {[
                { label: "Patient", value: patientLabel },
                {
                  label: "Diagnosis date",
                  value: new Date().toLocaleDateString(),
                },
                { label: "Primary classification", value: diagnosisLabel },
                {
                  label: "Report components",
                  value: `${sectionCount} sections`,
                },
                { label: "Export format", value: format.toUpperCase() },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-medium">{value}</span>
                </div>
              ))}
            </div>

            <Alert variant="warning" title="For licensed professionals only">
              <span className="text-xs">
                AI predictions must be confirmed through clinical evaluation and
                histopathology when indicated.
              </span>
            </Alert>

            <div className="mt-5 flex gap-3 flex-wrap">
              <Button variant="outline" onClick={handlePreview}>
                <Eye size={14} /> Preview
              </Button>
              <Button
                variant="brand"
                onClick={handleExport}
                disabled={isGenerating || !caseData}
                className="flex-1"
              >
                <Download size={14} />
                {isGenerating
                  ? "Saving…"
                  : `Generate ${format.toUpperCase()}`}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              Preview only — server-side PDF export coming in a later release.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
