"use client";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { AdminManagement } from "@/components/AdminManagement";

export default function AdminPage() {
  const router = useRouter();
  return (
    <>
      <Navigation
        currentScreen="admin"
        userRole="admin"
        onNavigate={(screen) => router.push(`/${screen}`)}
        onLogout={() => router.push("/login")}
      />
      <AdminManagement />
    </>
  );
}
