"use client";
import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Layers,
  ScrollText,
  Settings,
  Upload,
  UploadCloud,
  Users,
  UsersRound,
} from "lucide-react";

import { AppShell, type NavItem } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";

const doctorNav: NavItem[] = [
  { path: "/doctor-dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/records", label: "Patients", icon: FolderOpen },
  { path: "/diagnostic", label: "New scan", icon: Upload },
  { path: "/results", label: "Recent results", icon: Activity },
  { path: "/report", label: "Reports", icon: FileText },
  { path: "/settings", label: "Settings", icon: Settings },
];

const adminNav: NavItem[] = [
  { path: "/dashboard", label: "Model metrics", icon: BarChart3 },
  { path: "/admin/models", label: "Model versions", icon: Layers },
  { path: "/admin/publish", label: "Publish model", icon: UploadCloud },
  { path: "/admin/patients", label: "Patient oversight", icon: UsersRound },
  { path: "/admin", label: "Users", icon: Users },
  { path: "/admin/audit", label: "Audit log", icon: ScrollText },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function AuthedLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) return null;
  if (!role) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-sm">
        <p className="text-muted-foreground">
          Your account profile could not be loaded.
        </p>
        <button
          className="text-brand font-medium"
          onClick={async () => {
            await createClient().auth.signOut();
            router.replace("/login");
          }}
        >
          Sign out and try again
        </button>
      </div>
    );
  }

  const nav = role === "admin" ? adminNav : doctorNav;

  return (
    <AppShell nav={nav} modelLive={role === "doctor"}>
      {children}
    </AppShell>
  );
}
