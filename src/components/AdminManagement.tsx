"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Edit,
  Eye,
  MoreHorizontal,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/primitives/PageHeader";
import { Avatar } from "@/components/primitives/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserRow {
  id: string;
  role: string;
  email: string;
  last_sign_in_at: string | null;
  created_at: string;
  full_name: string | null;
  scans_count: number;
  suspended: boolean;
}

type Status = "active" | "pending" | "suspended";

interface AugmentedUser extends UserRow {
  status: Status;
  joined: string;
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

function computeStatus(u: UserRow): Status {
  if (u.suspended) return "suspended";
  if (u.last_sign_in_at) return "active";
  return "pending";
}

function augment(u: UserRow): AugmentedUser {
  return {
    ...u,
    status: computeStatus(u),
    joined: u.created_at ? u.created_at.slice(0, 10) : "—",
  };
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

type DialogKind =
  | { kind: "invite" }
  | { kind: "profile"; user: AugmentedUser }
  | { kind: "role"; user: AugmentedUser }
  | { kind: "suspend"; user: AugmentedUser; to: boolean }
  | { kind: "mfa"; user: AugmentedUser };

export function AdminManagement() {
  const [users, setUsers] = useState<AugmentedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabValue>("all");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [busy, setBusy] = useState(false);

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

  useEffect(() => {
    void load();
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

  const refresh = async () => {
    setLoading(true);
    await load();
  };

  const accessToken = async (): Promise<string | null> => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const handleSuspend = async (target: AugmentedUser, v: boolean) => {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_set_user_suspended", {
      target: target.id,
      v,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message || "Failed to update suspension");
      return;
    }
    toast.success(v ? `${target.email} suspended` : `${target.email} restored`);
    setDialog(null);
    await refresh();
  };

  const handleRole = async (target: AugmentedUser, newRole: string) => {
    if (newRole === target.role) {
      setDialog(null);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_update_user_role", {
      target: target.id,
      new_role: newRole,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message || "Failed to update role");
      return;
    }
    toast.success(`${target.email} → ${newRole}`);
    setDialog(null);
    await refresh();
  };

  const handleInvite = async (email: string, role: string) => {
    const token = await accessToken();
    if (!token) {
      toast.error("Not authenticated");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email, role }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || `Invite failed (${res.status})`);
      return;
    }
    toast.success(`Invitation sent to ${email}`);
    setDialog(null);
    await refresh();
  };

  const handleMfaReset = async (target: AugmentedUser) => {
    const token = await accessToken();
    if (!token) {
      toast.error("Not authenticated");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/reset-mfa", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ user_id: target.id }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || `2FA reset failed (${res.status})`);
      return;
    }
    toast.success(`2FA factors cleared for ${target.email}`);
    setDialog(null);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="User management"
        subtitle={`${users.length} users · ${pendingCount} pending verification`}
        breadcrumb={["Admin", "Users"]}
        actions={
          <Button variant="brand" onClick={() => setDialog({ kind: "invite" })}>
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
                      <td className="px-5 py-3 text-sm capitalize">{u.role}</td>
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
                      <td className="px-5 py-3 mono text-sm">{u.scans_count}</td>
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
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() =>
                                setDialog({ kind: "profile", user: u })
                              }
                            >
                              <Eye size={14} /> View profile
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDialog({ kind: "role", user: u })}
                            >
                              <Edit size={14} /> Edit role
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDialog({ kind: "mfa", user: u })}
                            >
                              <Shield size={14} /> Reset 2FA
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {u.suspended ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  setDialog({
                                    kind: "suspend",
                                    user: u,
                                    to: false,
                                  })
                                }
                              >
                                <UserCheck size={14} /> Restore access
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() =>
                                  setDialog({
                                    kind: "suspend",
                                    user: u,
                                    to: true,
                                  })
                                }
                              >
                                <Trash2 size={14} /> Suspend
                              </DropdownMenuItem>
                            )}
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

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          {dialog?.kind === "invite" && (
            <InviteForm onSubmit={handleInvite} busy={busy} />
          )}
          {dialog?.kind === "profile" && <ProfileView user={dialog.user} />}
          {dialog?.kind === "role" && (
            <RoleForm
              user={dialog.user}
              onSubmit={(r) => handleRole(dialog.user, r)}
              busy={busy}
            />
          )}
          {dialog?.kind === "suspend" && (
            <ConfirmBody
              title={dialog.to ? "Suspend user?" : "Restore access?"}
              description={
                dialog.to
                  ? `${dialog.user.email} will be signed out and blocked from signing in.`
                  : `${dialog.user.email} will regain access on next sign-in.`
              }
              confirmLabel={dialog.to ? "Suspend" : "Restore"}
              destructive={dialog.to}
              busy={busy}
              onConfirm={() => handleSuspend(dialog.user, dialog.to)}
              onCancel={() => setDialog(null)}
            />
          )}
          {dialog?.kind === "mfa" && (
            <ConfirmBody
              title="Reset 2FA factors?"
              description={`All enrolled MFA factors for ${dialog.user.email} will be deleted. They will need to re-enroll on next sign-in.`}
              confirmLabel="Reset 2FA"
              destructive
              busy={busy}
              onConfirm={() => handleMfaReset(dialog.user)}
              onCancel={() => setDialog(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InviteForm({
  onSubmit,
  busy,
}: {
  onSubmit: (email: string, role: string) => void;
  busy: boolean;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("doctor");
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return (
    <>
      <DialogHeader>
        <DialogTitle>Invite clinician</DialogTitle>
        <DialogDescription>
          Sends a Supabase invitation email with the selected role pre-set.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-3 py-2">
        <div>
          <Label htmlFor="invite-email" className="text-xs">
            Email
          </Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="clinician@clinic.org"
          />
        </div>
        <div>
          <Label className="text-xs">Role</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="doctor">Doctor</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button
          variant="brand"
          disabled={!valid || busy}
          onClick={() => onSubmit(email, role)}
        >
          {busy ? "Sending…" : "Send invite"}
        </Button>
      </DialogFooter>
    </>
  );
}

function ProfileView({ user }: { user: AugmentedUser }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{user.full_name ?? user.email}</DialogTitle>
        <DialogDescription className="mono text-xs">{user.email}</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3 py-2 text-sm">
        <Field label="Role" value={user.role} />
        <Field label="Status" value={user.status} />
        <Field label="Joined" value={user.joined} />
        <Field label="Last sign-in" value={timeSince(user.last_sign_in_at)} />
        <Field label="Scans" value={String(user.scans_count)} />
        <Field label="ID" value={user.id.slice(0, 12)} />
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide mono">
        {label}
      </div>
      <div className="font-medium capitalize">{value}</div>
    </div>
  );
}

function RoleForm({
  user,
  onSubmit,
  busy,
}: {
  user: AugmentedUser;
  onSubmit: (r: string) => void;
  busy: boolean;
}) {
  const [role, setRole] = useState(user.role);
  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit role</DialogTitle>
        <DialogDescription>
          Update role for {user.email}. User must re-authenticate for the change
          to apply.
        </DialogDescription>
      </DialogHeader>
      <div className="py-2">
        <Label className="text-xs">Role</Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="doctor">Doctor</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button
          variant="brand"
          disabled={busy || role === user.role}
          onClick={() => onSubmit(role)}
        >
          {busy ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}

function ConfirmBody({
  title,
  description,
  confirmLabel,
  destructive,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant={destructive ? "destructive" : "brand"}
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? "Working…" : confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}
