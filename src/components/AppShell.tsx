"use client";
import { ReactNode, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  Search,
  Settings,
  Sun,
  User as UserIcon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { LogoWord } from "@/components/primitives/Logo";
import { Avatar } from "@/components/primitives/Avatar";
import { Kbd } from "@/components/primitives/Kbd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

export type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
};

export function AppShell({
  nav,
  children,
  modelLive,
}: {
  nav: NavItem[];
  children: ReactNode;
  modelLive?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { user, role, signOut } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [shellSearch, setShellSearch] = useState("");
  type Suggestion = { id: string; patient_id: string; name: string };
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  type ModelVersion = {
    version: string;
    status: string;
    architecture?: string | null;
    params?: string | null;
    notes?: string | null;
    date?: string | null;
  };
  const [modelOpen, setModelOpen] = useState(false);
  const [activeModel, setActiveModel] = useState<ModelVersion | null>(null);
  const [modelLoading, setModelLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/model/versions");
        const json = await res.json();
        const prod = (json.versions ?? []).find(
          (v: ModelVersion) => v.status === "production"
        );
        if (!cancelled) setActiveModel(prod ?? (json.versions ?? [])[0] ?? null);
      } catch {
        // sidebar falls back to neutral copy
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const patientTarget = role === "admin" ? "/admin/patients" : "/records";

  const submitShellSearch = () => {
    const q = shellSearch.trim();
    setSuggestOpen(false);
    router.push(q ? `${patientTarget}?q=${encodeURIComponent(q)}` : patientTarget);
  };

  useEffect(() => {
    const q = shellSearch.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const supabase = createClient();
    const handle = setTimeout(async () => {
      const escaped = q.replace(/[%_,]/g, "\\$&");
      const { data } = await supabase
        .from("patients")
        .select("id, patient_id, name")
        .or(`name.ilike.%${escaped}%,patient_id.ilike.%${escaped}%`)
        .order("created_at", { ascending: false })
        .limit(6);
      setSuggestions((data ?? []) as Suggestion[]);
    }, 180);
    return () => clearTimeout(handle);
  }, [shellSearch]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (
        searchWrapRef.current &&
        !searchWrapRef.current.contains(e.target as Node)
      ) {
        setSuggestOpen(false);
      }
    };
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, []);

  const pickSuggestion = (s: Suggestion) => {
    setSuggestOpen(false);
    setShellSearch("");
    router.push(`${patientTarget}?q=${encodeURIComponent(s.patient_id)}`);
  };

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "User";
  const email = user?.email ?? "";

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    router.push("/login");
  };

  const go = (path: string) => {
    setDrawerOpen(false);
    router.push(path);
  };

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");

  const SidebarContent = () => (
    <>
      <div className="px-5 flex items-center h-14 border-b border-border">
        <LogoWord size={22} />
      </div>

      <nav className="flex-1 p-3 overflow-auto">
        {nav.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => go(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded mb-0.5 text-sm transition ${
                active
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon size={16} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge != null && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {modelLive && (
          <div
            className="mt-6 p-3 rounded-md border border-border"
            style={{ background: "hsl(var(--brand) / 0.05)" }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="rounded-full inline-block pulse-dot"
                style={{
                  width: 6,
                  height: 6,
                  background: "hsl(var(--brand))",
                }}
              />
              <span
                className="mono text-[10px] font-medium uppercase tracking-wide"
                style={{ color: "hsl(var(--brand))" }}
              >
                Model live
              </span>
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed mb-2">
              {activeModel
                ? `${activeModel.version} · ${activeModel.architecture ?? "ISIC-2019"}`
                : "Loading model…"}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-[11px]"
              onClick={async () => {
                setModelOpen(true);
                if (!activeModel && !modelLoading) {
                  setModelLoading(true);
                  try {
                    const res = await fetch("/api/model/versions");
                    const json = await res.json();
                    const prod = (json.versions ?? []).find(
                      (v: ModelVersion) => v.status === "production"
                    );
                    setActiveModel(prod ?? (json.versions ?? [])[0] ?? null);
                  } catch {
                    // swallow — dialog still opens with fallback copy
                  } finally {
                    setModelLoading(false);
                  }
                }
              }}
            >
              View model card
            </Button>
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2 p-2 rounded">
          <Avatar name={displayName} size={32} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{displayName}</div>
            <div className="text-xs text-muted-foreground capitalize">
              {role ?? ""}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => go("/settings")}>
                <Settings size={14} /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-destructive focus:text-destructive"
              >
                <LogOut size={14} /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex flex-col border-r border-border w-[240px] flex-shrink-0">
        <SidebarContent />
      </aside>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="p-0 w-[260px] flex flex-col">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent />
        </SheetContent>
      </Sheet>

      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-5 border-b border-border h-14 bg-background">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden -ml-2"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu size={16} />
            </Button>
            <div
              className="relative w-full max-w-[380px]"
              ref={searchWrapRef}
            >
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search patients by name or ID…"
                className="h-9 pl-9 pr-12"
                value={shellSearch}
                onChange={(e) => {
                  setShellSearch(e.target.value);
                  setSuggestOpen(true);
                }}
                onFocus={() => setSuggestOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitShellSearch();
                  } else if (e.key === "Escape") {
                    setSuggestOpen(false);
                  }
                }}
                aria-label="Search patients"
              />
              <button
                type="button"
                onClick={submitShellSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:block text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Submit search"
                title="Search"
              >
                <Kbd>↵</Kbd>
              </button>
              {suggestOpen &&
                shellSearch.trim().length >= 2 &&
                suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 rounded-md border border-border bg-popover shadow-card-md overflow-hidden z-50">
                    <ul className="max-h-72 overflow-y-auto">
                      {suggestions.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pickSuggestion(s)}
                            className="w-full text-left px-3 py-2 hover:bg-muted/60 flex items-center justify-between gap-3"
                          >
                            <span className="text-sm font-medium truncate">
                              {s.name}
                            </span>
                            <span className="text-xs mono text-muted-foreground shrink-0">
                              {s.patient_id}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={submitShellSearch}
                      className="w-full text-left px-3 py-2 border-t border-border text-xs text-muted-foreground hover:bg-muted/60"
                    >
                      View all results for{" "}
                      <span className="font-medium text-foreground">
                        {shellSearch.trim()}
                      </span>
                    </button>
                  </div>
                )}
              {suggestOpen &&
                shellSearch.trim().length >= 2 &&
                suggestions.length === 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 rounded-md border border-border bg-popover shadow-card-md px-3 py-2 text-xs text-muted-foreground z-50">
                    No patients match{" "}
                    <span className="mono">{shellSearch.trim()}</span>
                  </div>
                )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Notifications"
              className="relative"
            >
              <Bell size={16} />
              <span
                className="absolute top-2 right-2 rounded-full"
                style={{
                  width: 7,
                  height: 7,
                  background: "hsl(var(--destructive))",
                  border: "2px solid hsl(var(--background))",
                }}
              />
            </Button>

            <div className="w-px h-5 bg-border mx-2" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-accent cursor-pointer">
                  <Avatar name={displayName} size={28} />
                  <div className="text-left hidden lg:block">
                    <div className="text-sm font-medium leading-tight">
                      {displayName}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize leading-tight">
                      {role ?? ""}
                    </div>
                  </div>
                  <ChevronDown
                    size={12}
                    className="text-muted-foreground ml-0.5"
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium">{displayName}</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    {email}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => go("/settings")}>
                  <UserIcon size={14} /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => go("/settings")}>
                  <Settings size={14} /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut size={14} /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex-1 overflow-auto">{children}</div>
      </main>

      <Dialog open={modelOpen} onOpenChange={setModelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Active model</DialogTitle>
          </DialogHeader>
          {modelLoading && (
            <div className="text-sm text-muted-foreground">Loading…</div>
          )}
          {!modelLoading && activeModel && (
            <dl className="text-sm divide-y divide-border">
              {[
                ["Version", activeModel.version],
                ["Status", activeModel.status],
                ["Architecture", activeModel.architecture ?? "—"],
                ["Params", activeModel.params ?? "—"],
                ["Deployed", activeModel.date ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="mono">{v}</dd>
                </div>
              ))}
              {activeModel.notes && (
                <div className="pt-3 text-xs text-muted-foreground">
                  {activeModel.notes}
                </div>
              )}
            </dl>
          )}
          {!modelLoading && !activeModel && (
            <div className="text-sm text-muted-foreground">
              No model registered yet.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
