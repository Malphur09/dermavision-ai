"use client";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { DiagnosisResults } from "@/components/DiagnosisResults";

export default function ResultsPage() {
  const router = useRouter();
  return (
    <>
      <Navigation
        currentScreen="results"
        userRole="doctor"
        onNavigate={(screen) => router.push(`/${screen}`)}
        onLogout={() => router.push("/login")}
      />
      <DiagnosisResults />
    </>
  );
}
