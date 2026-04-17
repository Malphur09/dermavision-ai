"use client";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { UserProfile } from "@/components/UserProfile";
import { useAuth } from "@/contexts/AuthContext";

export default function ProfilePage() {
  const router = useRouter();
  const { role, loading, signOut } = useAuth();

  if (loading || !role) return null;

  return (
    <>
      <Navigation
        currentScreen="profile"
        userRole={role}
        onNavigate={(screen) => router.push(`/${screen}`)}
        onLogout={async () => { await signOut(); router.push("/login"); }}
      />
      <UserProfile />
    </>
  );
}
