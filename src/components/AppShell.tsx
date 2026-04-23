"use client";
import { ReactNode, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
              {/* MOCK: model card copy */}
              v3.2.1 · 91.3% balanced accuracy on ISIC-2019 validation.
            </div>
            <Button variant="outline" size="sm" className="w-full h-7 text-[11px]">
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
            <div className="relative w-full max-w-[380px]">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search patients, scans, models…"
                className="h-9 pl-9 pr-12"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:block">
                <Kbd>⌘K</Kbd>
              </div>
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
    </div>
  );
}
