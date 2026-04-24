"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { logPhiAccess } from "@/lib/audit";
import { PageHeader } from "@/components/primitives/PageHeader";
import { Avatar } from "@/components/primitives/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

interface PatientRecord {
  patientDbId: string;
  patientId: string;
  name: string;
  age: number | null;
  sex: string | null;
  lastDiagnosis: string | null;
  prediction: string | null;
  confidence: number | null;
  risk: "High Risk" | "Moderate Risk" | "Benign" | null;
  scans: number;
  caseId: string | null;
}

type RiskFilter = "all" | "High Risk" | "Moderate Risk" | "Benign";

const PAGE_SIZE = 10;

const RISK_BADGE: Record<
  "High Risk" | "Moderate Risk" | "Benign",
  { bg: string; color: string; label: string }
> = {
  "High Risk": {
    bg: "hsl(var(--destructive) / 0.1)",
    color: "hsl(var(--destructive))",
    label: "High",
  },
  "Moderate Risk": {
    bg: "hsl(var(--warning) / 0.12)",
    color: "hsl(var(--warning))",
    label: "Moderate",
  },
  Benign: {
    bg: "hsl(var(--success) / 0.12)",
    color: "hsl(var(--success))",
    label: "Benign",
  },
};

export function PatientRecords() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialQuery);
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_patient_records");

      if (error) {
        toast.error("Failed to load patient records");
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as Array<{
        patient_db_id: string;
        patient_id: string;
        name: string;
        age: number | null;
        sex: string | null;
        latest_case_id: string | null;
        latest_predicted_class: string | null;
        latest_confidence: number | null;
        latest_risk_level: string | null;
        latest_created_at: string | null;
        scans_count: number;
      }>;

      setRecords(
        rows.map((r) => ({
          patientDbId: r.patient_db_id,
          patientId: r.patient_id,
          name: r.name,
          age: r.age,
          sex: r.sex,
          lastDiagnosis: r.latest_created_at
            ? new Date(r.latest_created_at).toLocaleDateString("en-CA")
            : null,
          prediction: r.latest_predicted_class,
          confidence: r.latest_confidence != null ? Number(r.latest_confidence) : null,
          risk:
            (r.latest_risk_level as "High Risk" | "Moderate Risk" | "Benign" | null) ??
            null,
          scans: Number(r.scans_count) || 0,
          caseId: r.latest_case_id,
        }))
      );
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(
    () =>
      records.filter((r) => {
        if (riskFilter !== "all" && r.risk !== riskFilter) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          r.patientId.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q)
        );
      }),
    [records, search, riskFilter]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const highRiskCount = records.filter((r) => r.risk === "High Risk").length;

  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    const headers = [
      "Patient ID",
      "Name",
      "Age",
      "Sex",
      "Last diagnosis",
      "Prediction",
      "Confidence",
      "Risk",
      "Scans",
    ];
    const escape = (v: string | number | null | undefined) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    filtered.forEach((r) => {
      lines.push(
        [
          r.patientId,
          r.name,
          r.age,
          r.sex,
          r.lastDiagnosis
            ? new Date(r.lastDiagnosis).toISOString().slice(0, 10)
            : "",
          r.prediction,
          r.confidence != null ? r.confidence.toFixed(1) : "",
          r.risk,
          r.scans,
        ]
          .map(escape)
          .join(",")
      );
    });
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `patients-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} patient(s)`);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Patients"
        subtitle={`${records.length} patients · ${highRiskCount} with high-risk flags`}
        breadcrumb={["Doctor", "Patients"]}
        actions={
          <>
            <Button
              variant="outline"
              onClick={exportCsv}
              title="Export filtered list as CSV"
            >
              <Download size={14} /> Export CSV
            </Button>
            <Button
              variant="brand"
              onClick={() => router.push("/diagnostic?new=1")}
            >
              <Plus size={14} /> New patient
            </Button>
          </>
        }
      />

      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between p-4 border-b border-border gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Search by name or ID"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-9 pl-9"
            />
          </div>
          <Tabs
            value={riskFilter}
            onValueChange={(v) => {
              setRiskFilter(v as RiskFilter);
              setPage(1);
            }}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="High Risk">High</TabsTrigger>
              <TabsTrigger value="Moderate Risk">Moderate</TabsTrigger>
              <TabsTrigger value="Benign">Benign</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-16 rounded" />
                </div>
              ))}
            </div>
          ) : paginated.length === 0 ? (
            <div className="p-12 text-center">
              <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-1">No records found</h3>
              <p className="text-sm text-muted-foreground">
                {search || riskFilter !== "all"
                  ? "Adjust search or filter"
                  : "No patient records yet"}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "Patient",
                    "ID",
                    "Age / Sex",
                    "Latest finding",
                    "Risk",
                    "Scans",
                    "Last visit",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-5 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((r) => {
                  const risk = r.risk ? RISK_BADGE[r.risk] : null;
                  return (
                    <tr
                      key={r.patientDbId}
                      className="border-b border-border hover:bg-muted/40 transition cursor-pointer"
                      onClick={() => {
                        if (!r.caseId) {
                          toast.info(`No case for ${r.patientId}`);
                          return;
                        }
                        void logPhiAccess({
                          resource_type: "patient",
                          resource_id: r.patientDbId,
                          action: "viewed",
                          metadata: { caseId: r.caseId },
                        });
                        router.push(`/results?caseId=${r.caseId}`);
                      }}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={r.name} size={32} />
                          <span className="text-sm font-medium">{r.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm mono text-muted-foreground">
                        {r.patientId}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        {r.age ?? "—"} · {r.sex ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        {r.prediction ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        {risk ? (
                          <span
                            className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
                            style={{
                              background: risk.bg,
                              color: risk.color,
                              border: `1px solid ${risk.color}33`,
                            }}
                          >
                            {risk.label}
                          </span>
                        ) : (
                          <Badge variant="secondary">Unknown</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm mono">{r.scans}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">
                        {r.lastDiagnosis ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <ChevronRight
                          size={14}
                          className="text-muted-foreground"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 text-xs text-muted-foreground border-t border-border">
            <span>
              Showing {paginated.length} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft size={12} />
              </Button>
              <span className="px-2 mono">
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight size={12} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
