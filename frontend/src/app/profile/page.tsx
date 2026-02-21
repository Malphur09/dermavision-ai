"use client";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { UserProfile } from "@/components/UserProfile";

export default function ProfilePage() {
  const router = useRouter();
  return (
    <>
      <Navigation
        currentScreen="profile"
        userRole="doctor"
        onNavigate={(screen) => router.push(`/${screen}`)}
        onLogout={() => router.push("/login")}
      />
      <UserProfile />
    </>
  );
}
