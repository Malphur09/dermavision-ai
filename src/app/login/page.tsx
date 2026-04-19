"use client";
import { useRouter } from "next/navigation";
import { AuthScreen } from "@/components/AuthScreen";

export default function LoginPage() {
  const router = useRouter();
  return <AuthScreen onLogin={() => router.push("/")} />;
}
