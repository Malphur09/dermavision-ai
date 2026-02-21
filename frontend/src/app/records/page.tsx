"use client";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { PatientRecords } from "@/components/PatientRecords";

export default function RecordsPage() {
  const router = useRouter();
  return (
    <>
      <Navigation
        currentScreen="records"
        userRole="doctor"
        onNavigate={(screen) => router.push(`/${screen}`)}
        onLogout={() => router.push("/login")}
      />
      <PatientRecords />
    </>
  );
}
