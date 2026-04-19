"use client";
import { useMemo, useState } from "react";
import { Download, FileText, Filter, Search } from "lucide-react";

import {
  ISIC_CLASSES,
  PATIENTS_SEED,
  type RiskBucket,
} from "@/lib/mock-data";
import { PageHeader } from "@/components/primitives/PageHeader";
import { Avatar } from "@/components/primitives/Avatar";
import { Alert } from "@/components/primitives/Alert";
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

const MOCK_CLINICIANS = [
  "Dr. Elena Voss",
  "Dr. Rajesh Patel",
  "Dr. Amelia Crane",
  "Dr. Jonas Berg",
];

// MOCK: KPI cards. Real values require `patients_admin_read` RLS + inference audit table.
const KPIS = [
  { l: "Total patients", v: "3,218", d: "+142 this month" },
  { l: "Scans processed", v: "12,847", d: "+1,284 last 7d" },
  { l: "Urgent flagged", v: "47", d: "8 awaiting review", warn: true },
  { l: "PHI access events", v: "1,942", d: "Last 24h" },
];

export function PatientOversight() {
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return PATIENTS_SEED.filter((p) => {
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
      );
    });
  }, [search]);

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

      <div className="mb-5">
        <Alert variant="info" title="Preview data">
          <span className="text-xs">
            Cross-clinician rows require <span className="mono">patients_admin_read</span> RLS
            policy. Showing seed data until the migration is applied.
          </span>
        </Alert>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {KPIS.map((k) => (
          <div
            key={k.l}
            className="rounded-lg border border-border bg-card p-5"
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
              {rows.map((p, i) => {
                const cls = ISIC_CLASSES.find((c) => c.code === p.topClass);
                const risk = RISK_META[p.risk];
                const doc = MOCK_CLINICIANS[i % MOCK_CLINICIANS.length];
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
                      {p.id}
                    </td>
                    <td className="px-5 py-3 text-sm">{doc}</td>
                    <td className="px-5 py-3 mono text-sm">{p.scans}</td>
                    <td className="px-5 py-3 text-sm">
                      {cls?.name ?? p.topClass}
                    </td>
                    <td className="px-5 py-3">
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
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground mono">
                      {p.lastVisit}
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
        </div>
      </div>
    </div>
  );
}
