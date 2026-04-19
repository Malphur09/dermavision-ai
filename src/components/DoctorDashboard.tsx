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
import {
  ISIC_CLASSES,
  PATIENTS_SEED,
  RECENT_SCANS,
  type RiskBucket,
} from "@/lib/mock-data";
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

interface Stats {
  scansToday: number | null;
  activePatients: number | null;
}

export function DoctorDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ scansToday: null, activePatients: null });

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const [todayRes, patientsRes] = await Promise.all([
        supabase
          .from("cases")
          .select("*", { count: "exact", head: true })
          .gte("created_at", startOfDay.toISOString()),
        supabase.from("patients").select("*", { count: "exact", head: true }),
      ]);
      setStats({
        scansToday: todayRes.count ?? 0,
        activePatients: patientsRes.count ?? 0,
      });
    };
    load();
  }, []);

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
      value: "4",
      delta: "2 urgent",
      icon: Clock,
      warn: true,
      mock: true,
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
      value: "91.3%",
      delta: "v3.2.1 live",
      icon: Brain,
      warn: false,
      mock: true,
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
              className="rounded-lg border border-border bg-card p-5"
            >
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
            {/* MOCK: replace with live cases query ordered by created_at desc */}
            {RECENT_SCANS.slice(0, 5).map((s) => {
              const cls = ISIC_CLASSES.find((c) => c.code === s.topClass);
              const risk = RISK_META[s.risk];
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
                      {s.patient}
                    </div>
                    <div className="text-xs text-muted-foreground mono">
                      {s.id} · {s.patientId}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {cls?.name ?? s.topClass}
                    </div>
                    <div className="text-xs text-muted-foreground mono">
                      {(s.conf * 100).toFixed(1)}% conf
                    </div>
                  </div>
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
                  <div className="text-xs text-muted-foreground w-[70px] text-right">
                    {s.when}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-semibold mb-1">Urgent follow-ups</h3>
          <p className="text-xs text-muted-foreground mb-4">
            High-risk predictions awaiting review
          </p>
          {/* MOCK: seed patients — swap for cases.risk_level = 'High Risk' + patient join */}
          {PATIENTS_SEED.filter((p) => p.risk === "high")
            .slice(0, 3)
            .map((p) => {
              const cls = ISIC_CLASSES.find((c) => c.code === p.topClass);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 py-3 border-b border-border last:border-0"
                >
                  <Avatar name={p.name} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {p.name}
                    </div>
                    <div className="text-xs text-muted-foreground mono truncate">
                      {p.id} · {cls?.name ?? p.topClass}
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
            })}
        </div>
      </div>
    </div>
  );
}
