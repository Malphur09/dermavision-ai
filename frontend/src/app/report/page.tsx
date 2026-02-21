"use client";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { ReportGeneration } from "@/components/ReportGeneration";

export default function ReportPage() {
  const router = useRouter();
  return (
    <>
      <Navigation
        currentScreen="report"
        userRole="doctor"
        onNavigate={(screen) => router.push(`/${screen}`)}
        onLogout={() => router.push("/login")}
      />
      <ReportGeneration />
    </>
  );
}
