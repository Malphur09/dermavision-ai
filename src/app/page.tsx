"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!role) {
      // Role unresolved — recover by signing out and sending to login.
      void createClient()
        .auth.signOut()
        .then(() => router.replace("/login"));
      return;
    }
    router.replace(role === "admin" ? "/dashboard" : "/doctor-dashboard");
  }, [loading, user, role, router]);

  return (
    <div className="flex items-center justify-center min-h-screen text-sm text-muted-foreground">
      Loading…
    </div>
  );
}
