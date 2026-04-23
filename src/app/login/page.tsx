"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthScreen } from "@/components/AuthScreen";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const suspended = params.get("suspended") === "1";
  return (
    <>
      {suspended && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-lg">
          <div className="font-medium">Account suspended</div>
          <div className="text-xs mt-0.5 opacity-90">
            Contact an administrator to restore access.
          </div>
        </div>
      )}
      <AuthScreen onLogin={() => router.push("/")} />
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
