"use client";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { DiagnosticInput } from "@/components/DiagnosticInput";

export default function DiagnosticPage() {
  const router = useRouter();
  return (
    <>
      <Navigation
        currentScreen="diagnostic"
        userRole="doctor"
        onNavigate={(screen) => router.push(`/${screen}`)}
        onLogout={() => router.push("/login")}
      />
      <DiagnosticInput onNavigateToResults={() => router.push("/results")} />
    </>
  );
}
