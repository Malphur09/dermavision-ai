"use client";
import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { DiagnosticInput } from "@/components/DiagnosticInput";

function DiagnosticInner() {
  const router = useRouter();
  return (
    <DiagnosticInput onNavigateToResults={() => router.push("/results")} />
  );
}

export default function DiagnosticPage() {
  return (
    <Suspense fallback={null}>
      <DiagnosticInner />
    </Suspense>
  );
}
