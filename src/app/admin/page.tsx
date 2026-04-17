"use client";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { AdminManagement } from "@/components/AdminManagement";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminPage() {
  const router = useRouter();
  const { role, loading, signOut } = useAuth();

  if (loading || !role) return null;

  return (
    <>
      <Navigation
        currentScreen="admin"
        userRole={role}
        onNavigate={(screen) => router.push(`/${screen}`)}
        onLogout={async () => { await signOut(); router.push("/login"); }}
      />
      <AdminManagement />
    </>
  );
}
