"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoWord } from "@/components/primitives/Logo";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          setReady(true);
        }
      }
    );
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async () => {
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      setError("Session expired. Request a new reset link.");
      setSubmitting(false);
      return;
    }
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 15_000);
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sess.session.access_token}`,
        },
        body: JSON.stringify({ password }),
        signal: controller.signal,
      });
      clearTimeout(t);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Password update failed (${res.status})`);
        setSubmitting(false);
        return;
      }
      toast.success("Password updated. Sign in again.");
      await supabase.auth.signOut();
      router.replace("/login");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg === "The user aborted a request." ? "Password update timed out" : msg);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/40">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-card-md">
        <div className="mb-6">
          <LogoWord size={28} />
        </div>
        <h2 className="text-xl font-semibold tracking-tight mb-1">
          Set a new password
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {ready
            ? "Enter a new password for your account."
            : "Waiting for recovery session. Open this page from the email link."}
        </p>
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="new-pw" className="mb-1.5 block">
              New password
            </Label>
            <div className="relative">
              <Lock
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="new-pw"
                type="password"
                className="pl-9"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={!ready || submitting}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="confirm-pw" className="mb-1.5 block">
              Confirm password
            </Label>
            <div className="relative">
              <Lock
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="confirm-pw"
                type="password"
                className="pl-9"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={!ready || submitting}
              />
            </div>
          </div>
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          <Button
            variant="brand"
            className="h-10"
            onClick={submit}
            disabled={!ready || submitting}
          >
            {submitting ? "Updating…" : "Update password"}
          </Button>
        </div>
      </div>
    </div>
  );
}
