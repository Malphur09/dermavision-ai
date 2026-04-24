"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Download, FileJson, FileText } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { logPhiAccess } from "@/lib/audit";
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
  const searchParams = useSearchParams();
  const paramCaseId = searchParams.get("caseId");
  const [caseData, setCaseData] = useState<CaseSession | null>(null);
  const [loadingCase, setLoadingCase] = useState(true);
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
    const supabase = createClient();

    const loadById = async (id: string) => {
      const { data, error } = await supabase
        .from("cases")
        .select(
          "id, predicted_class, confidence, risk_level, patients(patient_id, name)"
        )
        .eq("id", id)
        .maybeSingle();
      if (error || !data) {
        setLoadingCase(false);
        return;
      }
      const row = data as unknown as {
        id: string;
        predicted_class: string | null;
        confidence: number | null;
        risk_level: string | null;
        patients: { patient_id: string | null; name: string | null } | null;
      };
      const pid = row.patients?.patient_id ?? undefined;
      const pname = row.patients?.name ?? undefined;
      setCaseData({
        caseId: row.id,
        patientId: pid,
        patientName: pname,
        patientLabel: [pid, pname].filter(Boolean).join(" · "),
        predictedClass: row.predicted_class ?? "Unknown",
        confidence:
          typeof row.confidence === "number" ? row.confidence : null,
        riskLevel: row.risk_level ?? "Benign",
      });
      setLoadingCase(false);
    };

    if (paramCaseId) {
      void loadById(paramCaseId);
      return;
    }

    const raw = sessionStorage.getItem("lastCase");
    if (raw) {
      try {
        setCaseData(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    }
    setLoadingCase(false);
  }, [paramCaseId]);

  const toggle = (k: SectionKey) =>
    setSections((p) => ({ ...p, [k]: !p[k] }));

  const hasAnySection = Object.values(sections).some(Boolean);

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
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");
      const resp = await fetch("/api/reports/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          case_id: caseData.caseId,
          sections,
          format,
        }),
      });
      toast.dismiss(toastId);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast.error(err.error || "Failed to generate report");
        return;
      }
      const data: { signed_url: string; format: string } = await resp.json();
      toast.success(`Report ready — ${data.format.toUpperCase()}`);
      window.open(data.signed_url, "_blank", "noopener,noreferrer");
      void logPhiAccess({
        resource_type: "case",
        resource_id: caseData.caseId,
        action: "exported",
        metadata: { format, sections },
      });
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(
        e instanceof Error ? e.message : "Failed to generate report"
      );
    } finally {
      setIsGenerating(false);
    }
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

      {!caseData && !loadingCase && (
        <div className="mb-5">
          <Alert variant="warning" title="No case loaded">
            {paramCaseId ? (
              <>Could not load case <span className="mono">{paramCaseId.slice(0, 8)}</span>. It may not exist or you may not have access.</>
            ) : (
              <>
                <button
                  onClick={() => router.push("/diagnostic")}
                  className="underline font-medium text-foreground"
                >
                  Run a diagnosis first
                </button>{" "}
                or pick one from{" "}
                <button
                  onClick={() => router.push("/records")}
                  className="underline font-medium text-foreground"
                >
                  Patient Records
                </button>
                .
              </>
            )}
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
              <Button
                variant="brand"
                onClick={handleExport}
                disabled={isGenerating || !caseData}
                className="flex-1"
              >
                <Download size={14} />
                {isGenerating
                  ? "Generating…"
                  : `Generate ${format.toUpperCase()}`}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              File opens in a new tab. Download link expires after 1 hour.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
