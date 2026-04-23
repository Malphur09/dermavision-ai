"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (role) router.replace(role === "admin" ? "/dashboard" : "/doctor-dashboard");
  }, [loading, user, role, router]);

  return (
    <div className="flex items-center justify-center min-h-screen text-sm text-muted-foreground">
      Loading…
    </div>
  );
}
