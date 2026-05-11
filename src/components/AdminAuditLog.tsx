"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/primitives/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AuditRow {
  id: string;
  created_at: string;
  user_id: string | null;
  action: string | null;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
}

const PAGE_SIZE = 50;

const ACTION_COLOR: Record<string, string> = {
  viewed: "hsl(var(--muted-foreground))",
  reviewed: "hsl(var(--success))",
  exported: "hsl(var(--brand))",
  created: "hsl(var(--brand))",
  deleted: "hsl(var(--destructive))",
};

export function AdminAuditLog() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [exporting, setExporting] = useState(false);

  const rangeSinceIso = (r: "7d" | "30d" | "90d" | "all"): string | null => {
    if (r === "all") return null;
    const d = new Date();
    if (r === "7d") d.setDate(d.getDate() - 7);
    else if (r === "30d") d.setDate(d.getDate() - 30);
    else d.setDate(d.getDate() - 90);
    return d.toISOString();
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("audit_logs")
        .select("id, created_at, user_id, action, resource_type, resource_id, metadata", {
          count: "exact",
        })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (actionFilter !== "all") query = query.eq("action", actionFilter);
      const since = rangeSinceIso(range);
      if (since) query = query.gte("created_at", since);
      if (debouncedSearch) {
        const esc = debouncedSearch.replace(/[,%()]/g, "");
        if (esc) {
          query = query.or(
            `resource_id.ilike.%${esc}%,resource_type.ilike.%${esc}%`
          );
        }
      }

      const { data, error, count } = await query;
      if (error) {
        toast.error("Failed to load audit log");
        setLoading(false);
        return;
      }
      const list = (data ?? []) as AuditRow[];
      setRows(list);
      setTotalCount(count ?? 0);

      const userIds = Array.from(
        new Set(list.map((r) => r.user_id).filter((v): v is string => Boolean(v)))
      );
      if (userIds.length) {
        const { data: details } = await supabase
          .from("user_details")
          .select("id, full_name")
          .in("id", userIds);
        const map: Record<string, string> = {};
        for (const d of details ?? []) {
          if (d.full_name) map[d.id] = d.full_name;
        }
        setNames(map);
      } else {
        setNames({});
      }
      setLoading(false);
    };
    void load();
  }, [page, actionFilter, debouncedSearch, range]);

  const filtered = rows;

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const csvEscape = (v: unknown) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const supabase = createClient();
      const now = new Date();
      const from = new Date(now);
      if (range === "7d") from.setDate(from.getDate() - 7);
      else if (range === "30d") from.setDate(from.getDate() - 30);
      else if (range === "90d") from.setDate(from.getDate() - 90);
      else from.setFullYear(from.getFullYear() - 5);

      const { data, error } = await supabase.rpc("admin_export_audit_logs", {
        from_ts: from.toISOString(),
        to_ts: now.toISOString(),
      });
      if (error) {
        toast.error(error.message || "Export failed");
        return;
      }
      const list = (data ?? []) as AuditRow[];
      const header = [
        "id",
        "created_at",
        "user_id",
        "action",
        "resource_type",
        "resource_id",
        "metadata",
      ];
      const csv = [
        header.join(","),
        ...list.map((r) =>
          header
            .map((k) => csvEscape((r as unknown as Record<string, unknown>)[k]))
            .join(",")
        ),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-${range}-${now.toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${list.length} event${list.length === 1 ? "" : "s"}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Audit log"
        subtitle={`${totalCount.toLocaleString()} total events · PHI access + sign-offs`}
        breadcrumb={["Admin", "Audit log"]}
      />

      <div className="rounded-lg border border-border bg-card">
        <div className="p-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Search resource id or type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
          <Tabs
            value={actionFilter}
            onValueChange={(v) => {
              setActionFilter(v);
              setPage(1);
            }}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="viewed">Viewed</TabsTrigger>
              <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
              <TabsTrigger value="exported">Exported</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2 ml-auto">
            <Select
              value={range}
              onValueChange={(v) => {
                setRange(v as typeof range);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7d</SelectItem>
                <SelectItem value="30d">Last 30d</SelectItem>
                <SelectItem value="90d">Last 90d</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              <Download size={14} /> {exporting ? "Exporting…" : "Export CSV"}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Loading audit log…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No events match current filter
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["When", "User", "Action", "Resource", "Resource ID", "Metadata"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-5 py-3"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const color = r.action
                    ? ACTION_COLOR[r.action] ?? "hsl(var(--muted-foreground))"
                    : "hsl(var(--muted-foreground))";
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-border last:border-0 hover:bg-muted/40 transition"
                    >
                      <td className="px-5 py-3 text-xs mono text-muted-foreground whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        {r.user_id ? names[r.user_id] ?? (
                          <span className="mono text-xs text-muted-foreground">
                            {r.user_id.slice(0, 8)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
                          style={{
                            background: `${color.replace(")", " / 0.12)")}`,
                            color,
                            border: `1px solid ${color}33`,
                          }}
                        >
                          {r.action ?? "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm capitalize">
                        {r.resource_type ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-xs mono text-muted-foreground">
                        {r.resource_id ? r.resource_id.slice(0, 12) : "—"}
                      </td>
                      <td className="px-5 py-3 text-xs mono text-muted-foreground max-w-[280px] truncate">
                        {r.metadata ? JSON.stringify(r.metadata) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && totalCount > 0 && (
          <div className="flex items-center justify-between px-5 py-3 text-xs text-muted-foreground border-t border-border">
            <span>
              Page {page} of {totalPages} · {PAGE_SIZE} per page
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
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
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
