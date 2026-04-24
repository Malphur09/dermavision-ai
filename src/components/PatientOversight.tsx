"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, FileText, Filter, Search } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { ISIC_CLASSES, type RiskBucket } from "@/lib/mock-data";
import { PageHeader } from "@/components/primitives/PageHeader";
import { Avatar } from "@/components/primitives/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const RISK_META: Record<RiskBucket, { label: string; bg: string; color: string }> = {
  high: {
    label: "High risk",
    bg: "hsl(var(--destructive) / 0.12)",
    color: "hsl(var(--destructive))",
  },
  med: {
    label: "Moderate",
    bg: "hsl(var(--warning) / 0.14)",
    color: "hsl(var(--warning))",
  },
  low: {
    label: "Low risk",
    bg: "hsl(var(--success) / 0.12)",
    color: "hsl(var(--success))",
  },
};

const RISK_FROM_LEVEL: Record<string, RiskBucket> = {
  "High Risk": "high",
  "Moderate Risk": "med",
  Benign: "low",
};

interface PatientRow {
  id: string;
  patient_id: string;
  name: string;
  clinician: string;
  scans: number;
  topClassFull: string | null;
  risk: RiskBucket | null;
  lastVisit: string | null;
}

interface Kpis {
  totalPatients: number;
  scansProcessed: number;
  urgentFlagged: number;
  phiAccess24h: number;
}

export function PatientOversight() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [
        patientsRes,
        casesRes,
        detailsRes,
        totalPatientsRes,
        totalScansRes,
        urgentRes,
        phiRes,
      ] = await Promise.all([
        supabase.from("patients").select("id, patient_id, name"),
        supabase
          .from("cases")
          .select("patient_id, doctor_id, predicted_class, risk_level, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("user_details").select("id, full_name"),
        supabase.from("patients").select("*", { count: "exact", head: true }),
        supabase.from("cases").select("*", { count: "exact", head: true }),
        supabase
          .from("cases")
          .select("*", { count: "exact", head: true })
          .eq("risk_level", "High Risk"),
        supabase
          .from("audit_logs")
          .select("*", { count: "exact", head: true })
          .gte("created_at", since),
      ]);

      if (patientsRes.error || casesRes.error || detailsRes.error) {
        toast.error("Failed to load oversight data");
        setLoading(false);
        return;
      }

      const detailsMap = new Map<string, string>();
      for (const d of detailsRes.data ?? []) {
        if (d.full_name) detailsMap.set(d.id, d.full_name);
      }

      const byPatient = new Map<
        string,
        {
          doctor_id: string;
          predicted_class: string | null;
          risk_level: string | null;
          created_at: string | null;
          count: number;
        }
      >();
      for (const c of casesRes.data ?? []) {
        const entry = byPatient.get(c.patient_id);
        if (!entry) {
          byPatient.set(c.patient_id, {
            doctor_id: c.doctor_id,
            predicted_class: c.predicted_class,
            risk_level: c.risk_level,
            created_at: c.created_at,
            count: 1,
          });
        } else {
          entry.count += 1;
        }
      }

      const built: PatientRow[] = (patientsRes.data ?? []).map((p) => {
        const latest = byPatient.get(p.id);
        return {
          id: p.id,
          patient_id: p.patient_id,
          name: p.name,
          clinician: latest ? detailsMap.get(latest.doctor_id) ?? "—" : "—",
          scans: latest?.count ?? 0,
          topClassFull: latest?.predicted_class ?? null,
          risk: latest?.risk_level ? RISK_FROM_LEVEL[latest.risk_level] ?? null : null,
          lastVisit: latest?.created_at
            ? new Date(latest.created_at).toISOString().slice(0, 10)
            : null,
        };
      });

      built.sort((a, b) => (b.lastVisit ?? "").localeCompare(a.lastVisit ?? ""));

      setRows(built);
      setKpis({
        totalPatients: totalPatientsRes.count ?? 0,
        scansProcessed: totalScansRes.count ?? 0,
        urgentFlagged: urgentRes.count ?? 0,
        phiAccess24h: phiRes.count ?? 0,
      });
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.patient_id.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const kpiCards = [
    {
      l: "Total patients",
      v: kpis ? kpis.totalPatients.toLocaleString() : "—",
      d: "All clinicians",
    },
    {
      l: "Scans processed",
      v: kpis ? kpis.scansProcessed.toLocaleString() : "—",
      d: "All time",
    },
    {
      l: "Urgent flagged",
      v: kpis ? kpis.urgentFlagged.toLocaleString() : "—",
      d: "risk_level = High Risk",
      warn: (kpis?.urgentFlagged ?? 0) > 0,
    },
    {
      l: "PHI access events",
      v: kpis ? kpis.phiAccess24h.toLocaleString() : "—",
      d: "Rolling 24h · audit_logs",
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Patient data oversight"
        subtitle="Aggregate patient records across all clinicians · read-only audit view"
        breadcrumb={["Admin", "Patient oversight"]}
        actions={
          <Button variant="outline">
            <Download size={14} /> Export audit log
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpiCards.map((k) => (
          <div
            key={k.l}
            className="rounded-lg border border-border bg-card p-5 relative"
          >
            <div className="text-xs text-muted-foreground uppercase tracking-wide mono mb-2">
              {k.l}
            </div>
            <div className="text-3xl font-semibold tracking-tight mono">
              {k.v}
            </div>
            <div
              className="text-xs mt-3 pt-3 border-t border-border"
              style={{
                color: k.warn ? "hsl(var(--warning))" : "hsl(var(--muted-foreground))",
              }}
            >
              {k.d}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card mb-6">
        <div className="p-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold">All patients</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sorted by most recent activity
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search patients…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-9 w-[220px]"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter size={12} /> Filters
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              Loading patients…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              No patients match current filter
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "Patient",
                    "ID",
                    "Assigned clinician",
                    "Scans",
                    "Latest finding",
                    "Risk",
                    "Last visit",
                    "Audit",
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
                {filtered.map((p) => {
                  const cls = p.topClassFull
                    ? ISIC_CLASSES.find((c) => c.full === p.topClassFull)
                    : null;
                  const risk = p.risk ? RISK_META[p.risk] : null;
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-border last:border-0 hover:bg-muted/40 transition"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={p.name} size={28} />
                          <span className="text-sm font-medium">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 mono text-sm text-muted-foreground">
                        {p.patient_id}
                      </td>
                      <td className="px-5 py-3 text-sm">{p.clinician}</td>
                      <td className="px-5 py-3 mono text-sm">{p.scans}</td>
                      <td className="px-5 py-3 text-sm">
                        {cls?.name ?? p.topClassFull ?? "—"}
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
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground mono">
                        {p.lastVisit ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <Button variant="ghost" size="sm">
                          <FileText size={12} /> Log
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
