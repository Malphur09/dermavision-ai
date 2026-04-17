"use client";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { AdminDashboard } from "@/components/AdminDashboard";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardPage() {
  const router = useRouter();
  const { role, loading, signOut } = useAuth();

  if (loading || !role) return null;

  return (
    <>
      <Navigation
        currentScreen="dashboard"
        userRole={role}
        onNavigate={(screen) => router.push(`/${screen}`)}
        onLogout={async () => { await signOut(); router.push("/login"); }}
      />
      <AdminDashboard />
    </>
  );
}
