"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthScreen } from "@/components/AuthScreen";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const suspended = params.get("suspended") === "1";
  return (
    <AuthScreen onLogin={() => router.push("/")} suspended={suspended} />
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
