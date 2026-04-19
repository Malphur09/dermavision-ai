"use client";
import { useRouter } from "next/navigation";
import { DiagnosticInput } from "@/components/DiagnosticInput";

export default function DiagnosticPage() {
  const router = useRouter();
  return (
    <DiagnosticInput onNavigateToResults={() => router.push("/results")} />
  );
}
