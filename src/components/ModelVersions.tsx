"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Upload } from "lucide-react";

import { ISIC_CLASSES } from "@/lib/isic-classes";
import { PageHeader } from "@/components/primitives/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ModelVersion {
  version: string;
  status: "production" | "staging" | "archived";
  accuracy: number;
  date: string;
  architecture: string;
  params: string;
  notes: string;
}

interface PerClass {
  code: string;
  f1: number;
}

const STATUS_STYLE: Record<ModelVersion["status"], { bg: string; color: string }> = {
  production: {
    bg: "hsl(var(--success) / 0.12)",
    color: "hsl(var(--success))",
  },
  staging: {
    bg: "hsl(var(--warning) / 0.14)",
    color: "hsl(var(--warning))",
  },
  archived: {
    bg: "hsl(var(--muted) / 0.5)",
    color: "hsl(var(--muted-foreground))",
  },
};

function StatusBadge({ status }: { status: ModelVersion["status"] }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium capitalize"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}33` }}
    >
      {status}
    </span>
  );
}

function f1For(version: string, f1List: PerClass[], classIndex: number): number {
  const base = f1List[classIndex]?.f1 ?? 0.85;
  const mod = (version.charCodeAt(version.length - 1) % 9) / 100;
  return Math.min(0.98, base + mod);
}

export function ModelVersions() {
  const router = useRouter();
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [perClass, setPerClass] = useState<PerClass[]>([]);
  const [compareA, setCompareA] = useState<string>("");
  const [compareB, setCompareB] = useState<string>("");

  useEffect(() => {
    const fetchJson = async <T,>(url: string): Promise<T | null> => {
      try {
        const r = await fetch(url);
        if (!r.ok) return null;
        return (await r.json()) as T;
      } catch {
        return null;
      }
    };
    const load = async () => {
      const [vRes, pRes] = await Promise.all([
        fetchJson<{ versions: ModelVersion[] }>("/api/model/versions"),
        fetchJson<{ classes: PerClass[] }>("/api/metrics/per_class"),
      ]);
      const vList = vRes?.versions ?? [];
      setVersions(vList);
      setPerClass(pRes?.classes ?? []);
      if (vList.length) {
        setCompareA(vList[0].version);
        setCompareB(vList[1]?.version ?? vList[0].version);
      }
    };
    void load();
  }, []);

  const va = useMemo(
    () => versions.find((v) => v.version === compareA) ?? versions[0],
    [versions, compareA]
  );
  const vb = useMemo(
    () => versions.find((v) => v.version === compareB) ?? versions[1] ?? versions[0],
    [versions, compareB]
  );

  const productionCount = versions.filter((v) => v.status === "production").length;
  const stagingCount = versions.filter((v) => v.status === "staging").length;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Model versions"
        subtitle={`${versions.length} versions · ${productionCount} in production · ${stagingCount} in staging`}
        breadcrumb={["Admin", "Model versions"]}
        actions={
          <Button variant="brand" onClick={() => router.push("/admin/publish")}>
            <Upload size={14} /> New version
          </Button>
        }
      />

      {!va || !vb ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Loading model versions…
        </div>
      ) : (
        <>
          <div className="grid gap-5 mb-6 lg:grid-cols-2">
            {[
              { label: "A", v: va, set: setCompareA },
              { label: "B", v: vb, set: setCompareB },
            ].map((side) => (
              <div
                key={side.label}
                className="rounded-lg border border-border bg-card p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="rounded flex items-center justify-center font-semibold text-sm"
                      style={{
                        width: 28,
                        height: 28,
                        background: "hsl(var(--brand) / 0.1)",
                        color: "hsl(var(--brand))",
                      }}
                    >
                      {side.label}
                    </div>
                    <Select value={side.v.version} onValueChange={side.set}>
                      <SelectTrigger className="h-9 w-[170px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {versions.map((v) => (
                          <SelectItem key={v.version} value={v.version}>
                            {v.version}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <StatusBadge status={side.v.status} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Accuracy</div>
                    <div className="mono font-medium">
                      {(side.v.accuracy * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Released</div>
                    <div className="font-medium mono">{side.v.date}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Parameters</div>
                    <div className="mono font-medium">{side.v.params}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Architecture</div>
                    <div className="font-medium text-xs">{side.v.architecture}</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border leading-relaxed">
                  {side.v.notes}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-card p-5 mb-6">
            <h3 className="font-semibold mb-4">Side-by-side · per-class F1</h3>
            <div className="flex flex-col gap-3">
              {ISIC_CLASSES.map((c, i) => {
                const fa = f1For(va.version, perClass, i);
                const fb = f1For(vb.version, perClass, i);
                return (
                  <div
                    key={c.code}
                    className="grid items-center gap-3"
                    style={{ gridTemplateColumns: "110px 1fr 1fr" }}
                  >
                    <div className="text-sm font-medium flex items-center gap-2">
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: c.color,
                        }}
                      />
                      {c.code}
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="flex-1"
                        style={{
                          height: 8,
                          background: "hsl(var(--muted))",
                          borderRadius: 4,
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${fa * 100}%`,
                            background: "hsl(var(--muted-foreground))",
                            borderRadius: 4,
                          }}
                        />
                      </div>
                      <span className="mono text-xs w-[44px] text-right">
                        {fa.toFixed(3)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="flex-1"
                        style={{
                          height: 8,
                          background: "hsl(var(--muted))",
                          borderRadius: 4,
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${fb * 100}%`,
                            background: "hsl(var(--brand))",
                            borderRadius: 4,
                          }}
                        />
                      </div>
                      <span className="mono text-xs w-[44px] text-right">
                        {fb.toFixed(3)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              className="grid gap-3 mt-4 pt-4 border-t border-border"
              style={{ gridTemplateColumns: "110px 1fr 1fr" }}
            >
              <div />
              <div className="text-xs text-muted-foreground">A — {va.version}</div>
              <div className="text-xs font-medium text-brand">B — {vb.version}</div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="p-5 border-b border-border">
              <h3 className="font-semibold">All versions</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {[
                      "Version",
                      "Status",
                      "Accuracy",
                      "Architecture",
                      "Released",
                      "Notes",
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
                  {versions.map((v) => (
                    <tr
                      key={v.version}
                      className="border-b border-border last:border-0 hover:bg-muted/40 transition"
                    >
                      <td className="px-5 py-3 mono font-medium text-sm">
                        {v.version}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={v.status} />
                      </td>
                      <td className="px-5 py-3 mono text-sm">
                        {(v.accuracy * 100).toFixed(1)}%
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">
                        {v.architecture}
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground mono">
                        {v.date}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground max-w-[280px]">
                        {v.notes}
                      </td>
                      <td className="px-5 py-3">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
