"use client";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { DiagnosisResults } from "@/components/DiagnosisResults";
import { useAuth } from "@/contexts/AuthContext";

export default function ResultsPage() {
  const router = useRouter();
  const { role, loading, signOut } = useAuth();

  if (loading || !role) return null;

  return (
    <>
      <Navigation
        currentScreen="results"
        userRole={role}
        onNavigate={(screen) => router.push(`/${screen}`)}
        onLogout={async () => { await signOut(); router.push("/login"); }}
      />
      <DiagnosisResults />
    </>
  );
}
