"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Edit,
  Eye,
  MoreHorizontal,
  Search,
  Shield,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/primitives/PageHeader";
import { Avatar } from "@/components/primitives/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserRow {
  id: string;
  role: string;
  email: string;
  last_sign_in_at: string | null;
  full_name: string | null;
}

type Status = "active" | "pending" | "suspended";

interface AugmentedUser extends UserRow {
  status: Status;
  scans: number; // MOCK
  joined: string; // MOCK
}

const STATUS_STYLE: Record<Status, { bg: string; color: string }> = {
  active: {
    bg: "hsl(var(--success) / 0.12)",
    color: "hsl(var(--success))",
  },
  pending: {
    bg: "hsl(var(--warning) / 0.14)",
    color: "hsl(var(--warning))",
  },
  suspended: {
    bg: "hsl(var(--destructive) / 0.12)",
    color: "hsl(var(--destructive))",
  },
};

// MOCK: until we have real status + scans + joined from backend
function augment(u: UserRow): AugmentedUser {
  const status: Status = u.last_sign_in_at ? "active" : "pending";
  const seed = u.id.charCodeAt(0) + u.id.charCodeAt(u.id.length - 1);
  const joinedDaysAgo = 30 + (seed % 400);
  const joined = new Date(Date.now() - joinedDaysAgo * 86400000)
    .toISOString()
    .slice(0, 10);
  return { ...u, status, scans: (seed * 13) % 250, joined };
}

function timeSince(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-CA");
}

type TabValue = "all" | Status;

export function AdminManagement() {
  const [users, setUsers] = useState<AugmentedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabValue>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_user_list");
      if (error || !data) {
        toast.error("Failed to load users");
        setLoading(false);
        return;
      }
      setUsers((data as UserRow[]).map(augment));
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(
    () =>
      users.filter((u) => {
        if (tab !== "all" && u.status !== tab) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          (u.full_name ?? "").toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        );
      }),
    [users, search, tab]
  );

  const pendingCount = users.filter((u) => u.status === "pending").length;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="User management"
        subtitle={`${users.length} users · ${pendingCount} pending verification`}
        breadcrumb={["Admin", "Users"]}
        actions={
          <Button
            variant="brand"
            onClick={() =>
              toast.info("Invitation flow via Supabase — not yet wired")
            }
          >
            <UserPlus size={14} /> Invite clinician
          </Button>
        }
      />

      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between p-4 border-b border-border gap-3 flex-wrap">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="suspended">Suspended</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative max-w-xs">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Search name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 w-[220px]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              Loading users…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              No users match current filter
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "Clinician",
                    "Role",
                    "Status",
                    "Scans",
                    "Joined",
                    "Last active",
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
                {filtered.map((u) => {
                  const style = STATUS_STYLE[u.status];
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-border last:border-0 hover:bg-muted/40 transition"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.full_name ?? u.email} size={32} />
                          <div>
                            <div className="text-sm font-medium">
                              {u.full_name ?? "—"}
                            </div>
                            <div className="text-xs text-muted-foreground mono">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm capitalize">
                        {u.role}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium capitalize"
                          style={{
                            background: style.bg,
                            color: style.color,
                            border: `1px solid ${style.color}33`,
                          }}
                        >
                          <span
                            className="rounded-full"
                            style={{
                              width: 6,
                              height: 6,
                              background: "currentColor",
                            }}
                          />
                          {u.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 mono text-sm">{u.scans}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground mono">
                        {u.joined}
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">
                        {timeSince(u.last_sign_in_at)}
                      </td>
                      <td className="px-5 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal size={14} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={() => toast.info("Profile view coming soon")}
                            >
                              <Eye size={14} /> View profile
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => toast.info("Role edit coming soon")}
                            >
                              <Edit size={14} /> Edit role
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => toast.info("2FA reset flow not yet wired")}
                            >
                              <Shield size={14} /> Reset 2FA
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() =>
                                toast.error(`Suspend ${u.email}?`, {
                                  action: {
                                    label: "Confirm",
                                    onClick: () =>
                                      toast.success(
                                        `${u.email} marked suspended`
                                      ),
                                  },
                                })
                              }
                            >
                              <Trash2 size={14} /> Suspend
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
