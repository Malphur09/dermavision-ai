"use client";
import { useEffect, useState, FormEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { LogoWord } from "@/components/primitives/Logo";

interface AuthScreenProps {
  onLogin: () => void;
  suspended?: boolean;
}

type Mode = "login" | "signup";

export function AuthScreen({ onLogin, suspended = false }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [license, setLicense] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [modelVersion, setModelVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/model/versions");
        const j = await r.json();
        const prod = (j.versions ?? []).find(
          (v: { status?: string }) => v.status === "production"
        );
        if (!cancelled) setModelVersion(prod?.version ?? null);
      } catch {
        // fallback handled by render
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    license?: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSending, setResetSending] = useState(false);

  const validate = () => {
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "Enter a valid email address";
    if (!password.trim()) next.password = "Password is required";
    else if (mode === "signup") {
      if (password.length < 8)
        next.password = "At least 8 characters";
      else if (!/[A-Z]/.test(password))
        next.password = "Must contain an uppercase letter";
      else if (!/[a-z]/.test(password))
        next.password = "Must contain a lowercase letter";
      else if (!/\d/.test(password))
        next.password = "Must contain a number";
    } else if (password.length < 6) {
      next.password = "Password must be at least 6 characters";
    }
    if (mode === "signup") {
      if (!firstName.trim()) next.firstName = "First name is required";
      if (!lastName.trim()) next.lastName = "Last name is required";
      const lic = license.trim();
      if (!lic) next.license = "SCFHS license number is required";
      else if (!/^[A-Z0-9-]{6,20}$/i.test(lic))
        next.license = "6–20 chars, letters/digits/dashes only";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleReset = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ email: "Enter a valid email address" });
      return;
    }
    setResetSending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetSending(false);
    if (error) {
      toast.error(error.message || "Failed to send reset email");
      return;
    }
    toast.success(`Reset link sent to ${email}`);
    setResetMode(false);
  };

  const clearErr = (
    field: "email" | "password" | "firstName" | "lastName" | "license"
  ) => {
    if (errors[field]) {
      setErrors((p) => {
        const n = { ...p };
        delete n[field];
        return n;
      });
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Fix errors before submitting");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    try {
      if (mode === "signup") {
        const fullName = [firstName, lastName].filter(Boolean).join(" ");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName || undefined,
              license: license || undefined,
            },
          },
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        if (!data.session) {
          setConfirmationSent(true);
          return;
        }
        toast.success("Account created. Welcome!");
        onLogin();
      } else {
        const { data: signInData, error } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });
        if (error) {
          toast.error("Invalid email or password");
          setErrors({ email: " ", password: "Invalid email or password" });
          return;
        }
        const userId = signInData.user?.id;
        if (userId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("suspended")
            .eq("id", userId)
            .maybeSingle();
          if (profile?.suspended) {
            await supabase.auth.signOut();
            toast.error(
              "Access not yet active. An administrator must approve your account."
            );
            return;
          }
        }
        toast.success("Welcome back!");
        onLogin();
      }
    } catch (err) {
      console.error("Auth error:", err);
      toast.error("Unexpected error, please try again");
    } finally {
      setLoading(false);
    }
  };

  if (resetMode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/40">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-card-md">
          <div className="mb-6">
            <LogoWord size={28} />
          </div>
          <h2 className="text-xl font-semibold tracking-tight mb-1">
            Reset password
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Enter your account email. We&apos;ll send a secure reset link.
          </p>
          <Label htmlFor="reset-email" className="mb-1.5 block">
            Email
          </Label>
          <div className="relative">
            <Mail
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="reset-email"
              type="email"
              className="pl-9"
              placeholder="you@clinic.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearErr("email");
              }}
              aria-invalid={!!errors.email?.trim()}
            />
          </div>
          {errors.email?.trim() && (
            <p className="mt-1.5 text-xs text-destructive">{errors.email}</p>
          )}
          <div className="flex gap-2 mt-6">
            <Button
              variant="brand"
              className="flex-1 h-10"
              disabled={resetSending}
              onClick={handleReset}
            >
              {resetSending ? "Sending…" : "Send reset link"}
            </Button>
            <Button
              variant="ghost"
              className="h-10"
              onClick={() => setResetMode(false)}
              disabled={resetSending}
            >
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (confirmationSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/40">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-card-md text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand/10 mb-4">
            <CheckCircle2 className="w-7 h-7 text-brand" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight mb-1">
            Check your email
          </h2>
          <p className="text-sm text-muted-foreground">
            Confirmation link sent to <strong>{email}</strong>. After you
            confirm, an administrator will review your request — you&apos;ll be
            notified once access is approved.
          </p>
          <Button
            variant="ghost"
            className="mt-6 text-brand"
            onClick={() => {
              setMode("login");
              setConfirmationSent(false);
            }}
          >
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  const formCard = (
    <div className="w-full">
      <div className="mb-6">
        <LogoWord size={28} />
      </div>
      {suspended && mode === "login" && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-md border border-destructive bg-destructive px-3.5 py-3 text-sm text-destructive-foreground shadow-card-md"
        >
          <AlertTriangle
            size={16}
            className="mt-0.5 shrink-0"
            aria-hidden
          />
          <div className="flex-1">
            <div className="font-medium leading-tight">
              Access not yet active
            </div>
            <div className="text-xs mt-1 opacity-90 leading-snug">
              If you just signed up, an administrator still needs to approve
              your access. Otherwise, contact an administrator to restore it.
            </div>
          </div>
        </div>
      )}
      <h1 className="text-2xl font-semibold tracking-tight mb-1">
        {mode === "login" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        {mode === "login"
          ? "Sign in to continue."
          : "Clinical access requires verification. A brief review follows sign-up."}
      </p>

      <form onSubmit={submit} className="flex flex-col gap-4">
        {mode === "signup" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fn" className="mb-1.5 block">
                First name
              </Label>
              <Input
                id="fn"
                placeholder="Osama"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  clearErr("firstName");
                }}
                aria-invalid={!!errors.firstName}
              />
              {errors.firstName && (
                <p className="mt-1.5 text-xs text-destructive">
                  {errors.firstName}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="ln" className="mb-1.5 block">
                Last name
              </Label>
              <Input
                id="ln"
                placeholder="Almutairi"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  clearErr("lastName");
                }}
                aria-invalid={!!errors.lastName}
              />
              {errors.lastName && (
                <p className="mt-1.5 text-xs text-destructive">
                  {errors.lastName}
                </p>
              )}
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="email" className="mb-1.5 block">
            Email
          </Label>
          <div className="relative">
            <Mail
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="email"
              type="email"
              className="pl-9"
              placeholder="you@clinic.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearErr("email");
              }}
              aria-invalid={!!errors.email?.trim()}
            />
          </div>
          {errors.email?.trim() && (
            <p className="mt-1.5 text-xs text-destructive">{errors.email}</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label htmlFor="pw">Password</Label>
            {mode === "login" && (
              <button
                type="button"
                className="text-xs text-brand cursor-pointer"
                onClick={() => setResetMode(true)}
              >
                Forgot?
              </button>
            )}
          </div>
          <div className="relative">
            <Lock
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="pw"
              type={showPw ? "text" : "password"}
              className="pl-9 pr-9"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearErr("password");
              }}
              aria-invalid={!!errors.password}
            />
            <button
              type="button"
              onClick={() => setShowPw((p) => !p)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {errors.password ? (
            <p className="mt-1.5 text-xs text-destructive">{errors.password}</p>
          ) : (
            mode === "signup" && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                8+ chars, with uppercase, lowercase, and a number.
              </p>
            )
          )}
        </div>

        {mode === "login" && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={remember}
              onCheckedChange={(v) => setRemember(v === true)}
            />
            <span className="text-sm">Keep me signed in on this device</span>
          </label>
        )}

        {mode === "signup" && (
          <div>
            <Label htmlFor="lic" className="mb-1.5 block">
              SCFHS License Number
            </Label>
            <Input
              id="lic"
              placeholder="e.g. 19002220 or 11RM00001"
              value={license}
              onChange={(e) => {
                setLicense(e.target.value);
                clearErr("license");
              }}
              aria-invalid={!!errors.license}
            />
            {errors.license ? (
              <p className="mt-1.5 text-xs text-destructive">
                {errors.license}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1.5">
                Saudi Commission for Health Specialties (SCFHS / Mumaris+).
              </p>
            )}
          </div>
        )}

        <Button
          type="submit"
          variant="brand"
          className="w-full h-10"
          disabled={loading}
        >
          {loading
            ? mode === "login"
              ? "Signing in…"
              : "Creating account…"
            : mode === "login"
              ? "Sign in"
              : "Request access"}
          {!loading && <ArrowRight size={14} />}
        </Button>
      </form>

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
        <span className="text-sm text-muted-foreground">
          {mode === "login"
            ? "Don't have access?"
            : "Already have an account?"}
        </span>
        <button
          type="button"
          className="text-sm font-medium text-brand"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setErrors({});
          }}
        >
          {mode === "login" ? "Request access" : "Sign in"}
        </button>
      </div>
    </div>
  );
  // Note: `formCard` is a JSX expression, not a component. Defining it as a
  // component (function) would create a new reference each render, causing
  // React to unmount/remount the inputs and lose focus on every keystroke.

  return (
    <div className="min-h-screen flex">
      {/* Left: hero */}
      <div
        className="relative overflow-hidden hidden md:flex flex-col justify-between text-white"
        style={{
          flex: "1 1 55%",
          minWidth: 0,
          padding: "48px 56px",
          background:
            "linear-gradient(135deg, hsl(var(--brand)) 0%, oklch(0.35 0.08 210) 100%)",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -100,
            right: -100,
            width: 380,
            height: 380,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 260,
            height: 260,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.2)",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            width: 160,
            height: 160,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.3)",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: -120,
            left: -120,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10">
          <LogoWord size={30} />
        </div>

        <div className="relative z-10 max-w-lg">
          <div
            className="inline-flex items-center gap-2 mb-5 px-3 py-1 rounded-full"
            style={{
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            <span
              className="pulse-dot rounded-full inline-block"
              style={{
                width: 6,
                height: 6,
                background: "oklch(0.85 0.15 140)",
              }}
            />
            <span className="text-xs mono tracking-wide">
              MODEL {modelVersion ?? "…"}
            </span>
          </div>
          <h2 className="text-4xl font-semibold tracking-tight mb-4 leading-tight">
            Decision support for
            <br />
            dermatologic oncology.
          </h2>
          <p
            className="text-base opacity-80 leading-relaxed"
            style={{ maxWidth: 440 }}
          >
            8-class ISIC classification with explainable Grad-CAM attribution.
            Built for clinicians who need confidence, not just a prediction.
          </p>
        </div>

        <div className="relative z-10 text-xs opacity-60">
          Not a diagnostic device. Intended for clinical decision support only.
        </div>
      </div>

      {/* Right: form */}
      <div
        className="flex items-center justify-center p-6 bg-background flex-1"
        style={{ minWidth: 380 }}
      >
        <div className="w-full max-w-md">{formCard}</div>
      </div>
    </div>
  );
}
