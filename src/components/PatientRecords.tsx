"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("cases")
        .select(
          "id, predicted_class, confidence, risk_level, created_at, patients(id, patient_id, name, age, sex)"
        )
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) {
        toast.error("Failed to load patient records");
        setLoading(false);
        return;
      }

      const map = new Map<string, PatientRecord>();
      for (const c of data ?? []) {
        const patient = c.patients as unknown as {
          id: string;
          patient_id: string;
          name: string;
          age: number | null;
          sex: string | null;
        } | null;
        if (!patient) continue;
        const existing = map.get(patient.id);
        if (existing) {
          existing.scans += 1;
          continue;
        }
        map.set(patient.id, {
          patientDbId: patient.id,
          patientId: patient.patient_id,
          name: patient.name,
          age: patient.age,
          sex: patient.sex,
          lastDiagnosis: c.created_at
            ? new Date(c.created_at).toLocaleDateString("en-CA")
            : null,
          prediction: c.predicted_class,
          confidence: c.confidence != null ? Number(c.confidence) : null,
          risk:
            (c.risk_level as "High Risk" | "Moderate Risk" | "Benign" | null) ??
            null,
          scans: 1,
          caseId: c.id,
        });
      }
      setRecords(Array.from(map.values()));
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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Patients"
        subtitle={`${records.length} patients · ${highRiskCount} with high-risk flags`}
        breadcrumb={["Doctor", "Patients"]}
        actions={
          <>
            {/* MOCK: export action */}
            <Button variant="outline">
              <Download size={14} /> Export
            </Button>
            <Button variant="brand">
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
