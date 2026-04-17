"use client";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { PatientRecords } from "@/components/PatientRecords";
import { useAuth } from "@/contexts/AuthContext";

export default function RecordsPage() {
  const router = useRouter();
  const { role, loading, signOut } = useAuth();

  if (loading || !role) return null;

  return (
    <>
      <Navigation
        currentScreen="records"
        userRole={role}
        onNavigate={(screen) => router.push(`/${screen}`)}
        onLogout={async () => { await signOut(); router.push("/login"); }}
      />
      <PatientRecords />
    </>
  );
}
