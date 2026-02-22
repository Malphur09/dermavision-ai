"use client";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { AdminDashboard } from "@/components/AdminDashboard";

export default function DashboardPage() {
  const router = useRouter();
  return (
    <>
      <Navigation
        currentScreen="dashboard"
        userRole="admin"
        onNavigate={(screen) => router.push(`/${screen}`)}
        onLogout={() => router.push("/login")}
      />
      <AdminDashboard />
    </>
  );
}
