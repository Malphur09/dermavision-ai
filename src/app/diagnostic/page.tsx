"use client";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { DiagnosticInput } from "@/components/DiagnosticInput";
import { useAuth } from "@/contexts/AuthContext";

export default function DiagnosticPage() {
  const router = useRouter();
  const { role, loading, signOut } = useAuth();

  if (loading || !role) return null;

  return (
    <>
      <Navigation
        currentScreen="diagnostic"
        userRole={role}
        onNavigate={(screen) => router.push(`/${screen}`)}
        onLogout={async () => { await signOut(); router.push("/login"); }}
      />
      <DiagnosticInput onNavigateToResults={() => router.push("/results")} />
    </>
  );
}
