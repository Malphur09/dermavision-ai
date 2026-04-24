"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Brain,
  Clock,
  Image as ImageIcon,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ISIC_CLASSES, type RiskBucket } from "@/lib/isic-classes";
import { PageHeader } from "@/components/primitives/PageHeader";
import { Avatar } from "@/components/primitives/Avatar";
import { Button } from "@/components/ui/button";

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

interface Stats {
  scansToday: number | null;
  activePatients: number | null;
  pendingReview: number | null;
  pendingUrgent: number | null;
}

interface RecentRow {
  id: string;
  created_at: string;
  predicted_class: string | null;
  confidence: number | null;
  risk_level: string | null;
  patient_name: string;
  patient_code: string;
}

interface UrgentRow {
  id: string;
  predicted_class: string | null;
  patient_id: string;
  patient_name: string;
  patient_code: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

export function DoctorDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    scansToday: null,
    activePatients: null,
    pendingReview: null,
    pendingUrgent: null,
  });
  const [recent, setRecent] = useState<RecentRow[] | null>(null);
  const [urgent, setUrgent] = useState<UrgentRow[] | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const supabase = createClient();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const [
        todayRes,
        patientsRes,
        pendingRes,
        pendingUrgentRes,
        recentRes,
        urgentRes,
      ] = await Promise.all([
        supabase
          .from("cases")
          .select("*", { count: "exact", head: true })
          .eq("doctor_id", user.id)
          .gte("created_at", startOfDay.toISOString()),
        supabase.from("patients").select("*", { count: "exact", head: true }),
        supabase
          .from("cases")
          .select("*", { count: "exact", head: true })
          .eq("doctor_id", user.id)
          .eq("status", "pending"),
        supabase
          .from("cases")
          .select("*", { count: "exact", head: true })
          .eq("doctor_id", user.id)
          .eq("status", "pending")
          .eq("risk_level", "High Risk"),
        supabase
          .from("cases")
          .select(
            "id, created_at, predicted_class, confidence, risk_level, patients ( name, patient_id )"
          )
          .eq("doctor_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("cases")
          .select(
            "id, predicted_class, patient_id, patients ( name, patient_id )"
          )
          .eq("doctor_id", user.id)
          .eq("risk_level", "High Risk")
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      setStats({
        scansToday: todayRes.count ?? 0,
        activePatients: patientsRes.count ?? 0,
        pendingReview: pendingRes.count ?? 0,
        pendingUrgent: pendingUrgentRes.count ?? 0,
      });

      type CaseJoin = {
        id: string;
        created_at: string;
        predicted_class: string | null;
        confidence: number | null;
        risk_level: string | null;
        patients: { name: string | null; patient_id: string | null } | null;
      };
      type UrgentJoin = {
        id: string;
        predicted_class: string | null;
        patient_id: string;
        patients: { name: string | null; patient_id: string | null } | null;
      };

      const recentRows: RecentRow[] = ((recentRes.data ?? []) as unknown as CaseJoin[]).map(
        (r) => ({
          id: r.id,
          created_at: r.created_at,
          predicted_class: r.predicted_class,
          confidence: r.confidence,
          risk_level: r.risk_level,
          patient_name: r.patients?.name ?? "—",
          patient_code: r.patients?.patient_id ?? "—",
        })
      );
      setRecent(recentRows);

      const urgentRows: UrgentRow[] = ((urgentRes.data ?? []) as unknown as UrgentJoin[]).map(
        (r) => ({
          id: r.id,
          predicted_class: r.predicted_class,
          patient_id: r.patient_id,
          patient_name: r.patients?.name ?? "—",
          patient_code: r.patients?.patient_id ?? "—",
        })
      );
      setUrgent(urgentRows);
    };
    load();
  }, [user]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const name =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "Doctor";

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const cards = [
    {
      label: "Scans today",
      value: stats.scansToday == null ? "—" : String(stats.scansToday),
      delta: "live",
      icon: ImageIcon,
      warn: false,
      mock: false,
    },
    {
      label: "Pending review",
      value: stats.pendingReview == null ? "—" : String(stats.pendingReview),
      delta:
        stats.pendingUrgent == null
          ? "live"
          : `${stats.pendingUrgent} urgent`,
      icon: Clock,
      warn: (stats.pendingUrgent ?? 0) > 0,
      mock: false,
    },
    {
      label: "Active patients",
      value: stats.activePatients == null ? "—" : String(stats.activePatients),
      delta: "live",
      icon: Users,
      warn: false,
      mock: false,
    },
    {
      label: "Model confidence",
      value: "—",
      delta: "",
      icon: Brain,
      warn: false,
      mock: false,
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title={`${greeting}, ${name}`}
        subtitle={today}
        breadcrumb={["Doctor", "Dashboard"]}
        actions={
          <>
            <Button variant="outline" onClick={() => router.push("/records")}>
              <Users size={14} /> All patients
            </Button>
            <Button variant="brand" onClick={() => router.push("/diagnostic")}>
              <Plus size={14} /> New scan
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="rounded-lg border border-border bg-card p-5 relative"
            >
              {c.mock && (
                <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wide mono rounded px-1.5 py-0.5 border border-border text-muted-foreground">
                  mock
                </span>
              )}
              <div className="flex items-center justify-between mb-3">
                <div
                  className="p-2 rounded-md"
                  style={{
                    background: c.warn
                      ? "hsl(var(--warning) / 0.14)"
                      : "hsl(var(--brand) / 0.1)",
                    color: c.warn ? "hsl(var(--warning))" : "hsl(var(--brand))",
                  }}
                >
                  <Icon size={16} />
                </div>
                <TrendingUp
                  size={14}
                  style={{ color: "hsl(var(--success))" }}
                />
              </div>
              <div className="text-3xl font-semibold tracking-tight mono">
                {c.value}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {c.label}
              </div>
              <div className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                {c.delta}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div>
              <h3 className="font-semibold">Recent scans</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Last 24 hours
              </p>
            </div>
            <button
              onClick={() => router.push("/results")}
              className="text-sm text-brand hover:underline"
            >
              View all →
            </button>
          </div>
          <div>
            {recent == null ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Loading scans…
              </div>
            ) : recent.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No scans yet — start a new one from the diagnostic page.
              </div>
            ) : (
              recent.map((s) => {
                const cls = s.predicted_class
                  ? ISIC_CLASSES.find((c) => c.full === s.predicted_class)
                  : null;
                const riskBucket = s.risk_level
                  ? RISK_FROM_LEVEL[s.risk_level] ?? null
                  : null;
                const risk = riskBucket ? RISK_META[riskBucket] : null;
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-4 px-5 py-3 border-b border-border last:border-0 hover:bg-muted/40 transition cursor-pointer"
                    onClick={() => router.push("/results")}
                  >
                    <div
                      className="rounded-md"
                      style={{
                        width: 44,
                        height: 44,
                        background:
                          "radial-gradient(circle at 30% 30%, oklch(0.75 0.1 40), oklch(0.35 0.12 30))",
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {s.patient_name}
                      </div>
                      <div className="text-xs text-muted-foreground mono">
                        {s.id.slice(0, 8)} · {s.patient_code}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {cls?.name ?? s.predicted_class ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground mono">
                        {s.confidence != null
                          ? `${(Number(s.confidence) * 100).toFixed(1)}% conf`
                          : "—"}
                      </div>
                    </div>
                    {risk && (
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
                    )}
                    <div className="text-xs text-muted-foreground w-[80px] text-right">
                      {timeAgo(s.created_at)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-semibold mb-1">Urgent follow-ups</h3>
          <p className="text-xs text-muted-foreground mb-4">
            High-risk predictions awaiting review
          </p>
          {urgent == null ? (
            <div className="py-6 text-center text-muted-foreground text-sm">
              Loading…
            </div>
          ) : urgent.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-sm">
              No urgent follow-ups.
            </div>
          ) : (
            urgent.map((p) => {
              const cls = p.predicted_class
                ? ISIC_CLASSES.find((c) => c.full === p.predicted_class)
                : null;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 py-3 border-b border-border last:border-0"
                >
                  <Avatar name={p.patient_name} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {p.patient_name}
                    </div>
                    <div className="text-xs text-muted-foreground mono truncate">
                      {p.patient_code} · {cls?.name ?? p.predicted_class ?? "—"}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push("/records")}
                  >
                    Open
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
