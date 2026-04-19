"use client";
import { FormEvent, useEffect, useState } from "react";
import { Building2, Lock, Mail, Save, Shield, User } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, type Accent } from "@/contexts/ThemeContext";
import { PageHeader } from "@/components/primitives/PageHeader";
import { Alert } from "@/components/primitives/Alert";
import { Avatar } from "@/components/primitives/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const ACCENT_SWATCHES: { value: Accent; color: string; label: string }[] = [
  { value: "teal", color: "oklch(0.55 0.11 195)", label: "Teal" },
  { value: "indigo", color: "oklch(0.50 0.18 275)", label: "Indigo" },
  { value: "emerald", color: "oklch(0.60 0.16 155)", label: "Emerald" },
  { value: "rose", color: "oklch(0.58 0.19 15)", label: "Rose" },
  { value: "amber", color: "oklch(0.70 0.15 65)", label: "Amber" },
];

export function Settings() {
  const { user, role } = useAuth();
  const { accent, setAccent } = useTheme();

  const [fullName, setFullName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [email, setEmail] = useState("");
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>(
    {}
  );

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [changingPw, setChangingPw] = useState(false);

  // MOCK: notification + clinic state — no persistence
  const [notifications, setNotifications] = useState({
    urgent: true,
    newResults: true,
    weeklyDigest: false,
    modelUpdates: true,
  });
  const [clinic, setClinic] = useState({
    name: "",
    taxId: "",
    address: "",
  });

  useEffect(() => {
    if (!user) return;
    setEmail(user.email ?? "");
    const supabase = createClient();
    supabase
      .from("user_details")
      .select("full_name, specialty")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFullName(data.full_name ?? "");
          setSpecialty(data.specialty ?? "");
        }
        setLoadingDetails(false);
      });
  }, [user]);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = "Name is required";
    if (!email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "Enter a valid email";
    setProfileErrors(errs);
    if (Object.keys(errs).length) {
      toast.error("Fix errors before saving");
      return;
    }

    setSavingProfile(true);
    const supabase = createClient();
    const upsert = supabase.from("user_details").upsert({
      id: user!.id,
      full_name: fullName.trim(),
      specialty: specialty.trim() || null,
    });
    const emailChanged = email !== user?.email;
    const emailUpdate = emailChanged
      ? supabase.auth.updateUser({ email })
      : Promise.resolve({ error: null });
    const [{ error: ue }, { error: ee }] = await Promise.all([
      upsert,
      emailUpdate,
    ]);
    if (ue || ee) toast.error("Failed to save profile");
    else
      toast.success(
        emailChanged
          ? "Saved — check your email to confirm address change"
          : "Profile updated"
      );
    setSavingProfile(false);
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!newPassword) errs.newPassword = "New password required";
    else if (newPassword.length < 8)
      errs.newPassword = "At least 8 characters";
    else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword))
      errs.newPassword = "Need uppercase, lowercase, and number";
    if (!confirmPassword) errs.confirmPassword = "Confirm password";
    else if (newPassword !== confirmPassword)
      errs.confirmPassword = "Passwords do not match";
    setPwErrors(errs);
    if (Object.keys(errs).length) return;

    setChangingPw(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) toast.error("Password change failed");
    else {
      toast.success("Password changed");
      setNewPassword("");
      setConfirmPassword("");
    }
    setChangingPw(false);
  };

  const displayName = fullName || user?.email?.split("@")[0] || "User";

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Settings"
        subtitle="Manage your profile, security, and clinic preferences."
        breadcrumb={["Account", "Settings"]}
      />

      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile">
            <User size={14} /> Profile
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield size={14} /> Security
          </TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="clinic">
            <Building2 size={14} /> Clinic
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-5">
          <div className="rounded-lg border border-border bg-card p-6">
            {loadingDetails ? (
              <p className="text-sm text-muted-foreground">Loading profile…</p>
            ) : (
              <form onSubmit={saveProfile} className="flex flex-col gap-5">
                <div className="flex items-center gap-4">
                  <Avatar name={displayName} size={64} />
                  <div>
                    <div className="font-medium">{displayName}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {role}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fn" className="mb-1.5 block">
                      Full name
                    </Label>
                    <Input
                      id="fn"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      aria-invalid={!!profileErrors.fullName}
                    />
                    {profileErrors.fullName && (
                      <p className="mt-1 text-xs text-destructive">
                        {profileErrors.fullName}
                      </p>
                    )}
                  </div>
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
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        aria-invalid={!!profileErrors.email}
                      />
                    </div>
                    {profileErrors.email && (
                      <p className="mt-1 text-xs text-destructive">
                        {profileErrors.email}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="sp" className="mb-1.5 block">
                    Specialty / Department
                  </Label>
                  <Input
                    id="sp"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="e.g. Dermatology & Skin Cancer"
                  />
                </div>

                <div>
                  <Label className="mb-1.5 block">Role</Label>
                  <Input
                    value={role === "admin" ? "Administrator" : "Doctor"}
                    disabled
                  />
                </div>

                <div>
                  <Label className="mb-2 block">Accent color</Label>
                  <div className="flex items-center gap-2">
                    {ACCENT_SWATCHES.map((sw) => (
                      <button
                        key={sw.value}
                        type="button"
                        title={sw.label}
                        onClick={() => setAccent(sw.value)}
                        aria-label={`Set accent to ${sw.label}`}
                        className="rounded-full transition"
                        style={{
                          width: 28,
                          height: 28,
                          background: sw.color,
                          border:
                            accent === sw.value
                              ? "2px solid hsl(var(--foreground))"
                              : "2px solid transparent",
                          boxShadow:
                            accent === sw.value
                              ? "0 0 0 2px hsl(var(--background))"
                              : undefined,
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <Button type="submit" variant="brand" disabled={savingProfile}>
                    <Save size={14} />{" "}
                    {savingProfile ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </TabsContent>

        <TabsContent value="security" className="mt-5">
          <div className="rounded-lg border border-border bg-card p-6">
            <form onSubmit={changePassword} className="flex flex-col gap-5">
              <div>
                <Label htmlFor="np" className="mb-1.5 block">
                  New password
                </Label>
                <div className="relative">
                  <Lock
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="np"
                    type="password"
                    className="pl-9"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    aria-invalid={!!pwErrors.newPassword}
                  />
                </div>
                {pwErrors.newPassword && (
                  <p className="mt-1 text-xs text-destructive">
                    {pwErrors.newPassword}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="cp" className="mb-1.5 block">
                  Confirm new password
                </Label>
                <div className="relative">
                  <Lock
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="cp"
                    type="password"
                    className="pl-9"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    aria-invalid={!!pwErrors.confirmPassword}
                  />
                </div>
                {pwErrors.confirmPassword && (
                  <p className="mt-1 text-xs text-destructive">
                    {pwErrors.confirmPassword}
                  </p>
                )}
              </div>

              <Alert variant="info" title="Password requirements">
                <span className="text-xs">
                  At least 8 characters with uppercase, lowercase, and a
                  number.
                </span>
              </Alert>

              <div>
                <Button type="submit" variant="brand" disabled={changingPw}>
                  <Lock size={14} />{" "}
                  {changingPw ? "Changing…" : "Change password"}
                </Button>
              </div>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="mt-5">
          <div className="rounded-lg border border-border bg-card p-6 flex flex-col gap-2">
            {/* MOCK: notification toggles — no persistence */}
            {[
              {
                key: "urgent",
                label: "Urgent alerts",
                desc: "High-risk predictions and critical findings",
              },
              {
                key: "newResults",
                label: "New results",
                desc: "When a scan completes and results are ready",
              },
              {
                key: "weeklyDigest",
                label: "Weekly digest",
                desc: "Summary of the week's cases every Monday",
              },
              {
                key: "modelUpdates",
                label: "Model updates",
                desc: "When the classification model is upgraded",
              },
            ].map(({ key, label, desc }) => {
              const k = key as keyof typeof notifications;
              return (
                <label
                  key={key}
                  className="flex items-center gap-4 p-3 rounded-md border border-border hover:bg-muted/40 cursor-pointer"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                  <Switch
                    checked={notifications[k]}
                    onCheckedChange={(v) =>
                      setNotifications((p) => ({ ...p, [k]: v === true }))
                    }
                  />
                </label>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="clinic" className="mt-5">
          <div className="rounded-lg border border-border bg-card p-6 flex flex-col gap-4">
            {/* MOCK: clinic fields — no persistence */}
            <div>
              <Label htmlFor="cn" className="mb-1.5 block">
                Clinic name
              </Label>
              <Input
                id="cn"
                value={clinic.name}
                onChange={(e) => setClinic((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="tx" className="mb-1.5 block">
                Tax ID
              </Label>
              <Input
                id="tx"
                value={clinic.taxId}
                onChange={(e) => setClinic((p) => ({ ...p, taxId: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="ad" className="mb-1.5 block">
                Address
              </Label>
              <Input
                id="ad"
                value={clinic.address}
                onChange={(e) =>
                  setClinic((p) => ({ ...p, address: e.target.value }))
                }
              />
            </div>
            <div>
              <Button variant="brand" disabled>
                Save clinic
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                {/* MOCK */}Clinic management is mocked; backend persistence pending.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
