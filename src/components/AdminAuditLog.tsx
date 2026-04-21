"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/primitives/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

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
      }
      setLoading(false);
    };
    void load();
  }, [page, actionFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = r.user_id ? names[r.user_id] ?? "" : "";
      return (
        (r.resource_id ?? "").toLowerCase().includes(q) ||
        (r.resource_type ?? "").toLowerCase().includes(q) ||
        name.toLowerCase().includes(q)
      );
    });
  }, [rows, search, names]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

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
              placeholder="Search user, resource…"
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
