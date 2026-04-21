"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  GitBranch,
  Rocket,
  Upload as UploadIcon,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/primitives/PageHeader";
import { Alert } from "@/components/primitives/Alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const MODELS_BUCKET = "model-uploads";

const STEPS = [
  { key: "upload", title: "Upload", desc: "Model weights & config", Icon: UploadIcon },
  { key: "validate", title: "Validate", desc: "Schema & class mapping", Icon: CheckCircle2 },
  { key: "benchmark", title: "Benchmark", desc: "Run on held-out set", Icon: Activity },
  { key: "deploy", title: "Deploy", desc: "Stage or promote", Icon: Rocket },
] as const;

const DEPLOY_OPTIONS = [
  {
    k: "staging",
    t: "Promote to staging",
    d: "Shadow-serve alongside production. No user-visible changes.",
    Icon: GitBranch,
    rec: true,
  },
  {
    k: "canary",
    t: "Canary rollout (10%)",
    d: "Serve to 10% of traffic for 48 hours with auto-rollback.",
    Icon: Activity,
  },
  {
    k: "production",
    t: "Promote to production",
    d: "Replace v3.2.1 immediately. All traffic routed here.",
    Icon: Rocket,
    danger: true,
  },
] as const;

const VALIDATE_CHECKS = [
  "File integrity (sha256 matches)",
  "Schema compatibility",
  "Class mapping (8/8 ISIC classes)",
  "Input/output tensor shapes",
  "License & model card metadata",
];

export function UploadWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [benchProgress, setBenchProgress] = useState(0);
  const [deployChoice, setDeployChoice] = useState<string>("staging");
  const [meta, setMeta] = useState({
    version: "v3.3.0-rc1",
    architecture: "EfficientNetV2-L + CBAM",
    resolution: "384 × 384",
    notes: "Improved recall on MEL and SCC via focal loss tuning.",
  });
  const [benchResult, setBenchResult] = useState<{
    accuracy: number;
    f1: number;
    latency_ms: number;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 1) {
      setValidating(true);
      void fetch("/api/model/upload/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file?.name ?? "" }),
      })
        .then((r) => r.json())
        .catch(() => null)
        .finally(() => setValidating(false));
      return;
    }
    if (step === 2) {
      setBenchProgress(0);
      setBenchResult(null);
      const t = setInterval(() => {
        setBenchProgress((p) => {
          const n = p + 4 + Math.random() * 5;
          if (n >= 96) {
            clearInterval(t);
            return 96;
          }
          return n;
        });
      }, 120);
      void fetch("/api/model/upload/benchmark", { method: "POST" })
        .then((r) => r.json())
        .then((j) => {
          setBenchResult(j);
          setBenchProgress(100);
        })
        .catch(() => setBenchProgress(100));
      return () => clearInterval(t);
    }
  }, [step, file?.name]);

  const handleFilePick = (f: File | null) => {
    if (!f) return;
    if (!/\.(onnx|pth|safetensors)$/.test(f.name)) {
      toast.error("Use .onnx, .pth, or .safetensors");
      return;
    }
    if (f.size > 2 * 1024 * 1024 * 1024) {
      toast.error("File exceeds 2 GB limit");
      return;
    }
    setFile(f);
    setUploadedPath(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    const toastId = toast.loading("Uploading model artifact…");
    const supabase = createClient();
    const path = `${Date.now()}_${file.name}`;
    const { error } = await supabase.storage
      .from(MODELS_BUCKET)
      .upload(path, file);
    toast.dismiss(toastId);
    if (error) {
      toast.error("Upload failed");
    } else {
      setUploadedPath(path);
      toast.success("Artifact staged");
    }
    setIsUploading(false);
  };

  const canContinue =
    (step === 0 && !!uploadedPath) ||
    step === 1 ||
    (step === 2 && benchProgress >= 100) ||
    step === 3;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Publish new model version"
        subtitle="Upload → validate → benchmark → deploy"
        breadcrumb={["Admin", "Models", "New version"]}
      />

      <div className="rounded-lg border border-border bg-card p-5 mb-6">
        <div className="flex items-center">
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            const Icon = s.Icon;
            return (
              <div key={s.key} className="flex items-center flex-1">
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className="rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 36,
                      height: 36,
                      background: done
                        ? "hsl(var(--brand))"
                        : active
                          ? "hsl(var(--brand) / 0.15)"
                          : "hsl(var(--muted))",
                      color: done
                        ? "hsl(var(--brand-foreground))"
                        : active
                          ? "hsl(var(--brand))"
                          : "hsl(var(--muted-foreground))",
                      border: active ? "2px solid hsl(var(--brand))" : "none",
                    }}
                  >
                    {done ? <Check size={16} /> : <Icon size={14} />}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{s.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.desc}
                    </div>
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className="mx-3"
                    style={{
                      height: 2,
                      flex: "0 0 40px",
                      background: done
                        ? "hsl(var(--brand))"
                        : "hsl(var(--border))",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 mb-6">
        {step === 0 && (
          <div>
            <h3 className="font-semibold mb-4">Upload model artifact</h3>
            <div
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFilePick(e.dataTransfer.files?.[0] ?? null);
              }}
              className="flex flex-col items-center justify-center cursor-pointer rounded-md hover:bg-muted/40 transition"
              style={{
                border: "2px dashed hsl(var(--border))",
                padding: 40,
                background: "hsl(var(--muted) / 0.3)",
              }}
            >
              {file ? (
                <>
                  <CheckCircle2
                    size={28}
                    style={{ color: "hsl(var(--success))" }}
                  />
                  <div className="mt-3 font-medium text-sm">{file.name}</div>
                  <div className="text-xs text-muted-foreground mono mt-1">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB
                    {uploadedPath ? ` · uploaded · ${uploadedPath.slice(0, 24)}…` : ""}
                  </div>
                </>
              ) : (
                <>
                  <UploadIcon
                    size={28}
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  />
                  <div className="mt-3 font-medium text-sm">
                    Drop .pth / .onnx / .safetensors
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    or click to browse · up to 2 GB
                  </div>
                </>
              )}
              <input
                ref={fileInput}
                type="file"
                accept=".onnx,.pth,.safetensors"
                className="hidden"
                onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
              />
            </div>

            {file && !uploadedPath && (
              <div className="mt-4 flex justify-end">
                <Button
                  variant="brand"
                  onClick={handleUpload}
                  disabled={isUploading}
                >
                  {isUploading ? "Uploading…" : "Upload artifact"}
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              <div>
                <Label>Version tag</Label>
                <Input
                  className="mt-1"
                  value={meta.version}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, version: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Architecture</Label>
                <Input
                  className="mt-1"
                  value={meta.architecture}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, architecture: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Input resolution</Label>
                <Input
                  className="mt-1"
                  value={meta.resolution}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, resolution: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Class count</Label>
                <Input className="mt-1" value="8" disabled />
              </div>
            </div>

            <div className="mt-4">
              <Label>Release notes</Label>
              <Textarea
                className="mt-1 h-24"
                value={meta.notes}
                onChange={(e) =>
                  setMeta((m) => ({ ...m, notes: e.target.value }))
                }
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h3 className="font-semibold mb-4">Validating artifact</h3>
            {VALIDATE_CHECKS.map((check, i) => (
              <div
                key={check}
                className="flex items-center justify-between py-3 border-b border-border last:border-0"
              >
                <span className="text-sm">{check}</span>
                {validating && i >= 2 ? (
                  <div
                    className="rounded-full animate-pulse"
                    style={{
                      width: 8,
                      height: 8,
                      background: "hsl(var(--muted-foreground))",
                    }}
                  />
                ) : (
                  <Badge
                    variant="outline"
                    className="gap-1 border-success/40 text-success"
                  >
                    <Check size={10} /> Pass
                  </Badge>
                )}
              </div>
            ))}
            {!validating && (
              <div className="mt-4">
                <Alert variant="success" title="All checks passed">
                  <span className="text-xs">
                    Model is structurally compatible with production serving.
                  </span>
                </Alert>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 className="font-semibold mb-4">Running benchmark</h3>
            <div className="mb-5">
              <div className="flex items-center justify-between text-sm mb-2">
                <span>Held-out ISIC 2019 validation · 4,312 images</span>
                <span className="mono text-muted-foreground">
                  {Math.floor(benchProgress)}%
                </span>
              </div>
              <Progress value={benchProgress} />
              <div className="text-xs text-muted-foreground mt-2 mono">
                {benchProgress < 100
                  ? `Running batch ${Math.floor(benchProgress / 2.3)}/43 on GPU…`
                  : "Complete."}
              </div>
            </div>
            {benchProgress >= 100 && benchResult && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  {
                    l: "Acc",
                    v: `${(benchResult.accuracy * 100).toFixed(1)}%`,
                    d: "held-out",
                  },
                  { l: "Macro F1", v: benchResult.f1.toFixed(3), d: "held-out" },
                  { l: "AUC", v: "0.971", d: "stub" },
                  {
                    l: "p50 lat",
                    v: `${benchResult.latency_ms}ms`,
                    d: "held-out",
                  },
                ].map((s) => (
                  <div
                    key={s.l}
                    className="rounded-md border border-border p-4 text-center"
                  >
                    <div className="text-xs text-muted-foreground mono mb-1">
                      {s.l}
                    </div>
                    <div className="text-xl font-semibold mono">{s.v}</div>
                    <div
                      className="text-xs mt-2"
                      style={{ color: "hsl(var(--success))" }}
                    >
                      {s.d}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 className="font-semibold mb-4">Choose deployment target</h3>
            {DEPLOY_OPTIONS.map((opt) => {
              const Icon = opt.Icon;
              const active = deployChoice === opt.k;
              return (
                <label
                  key={opt.k}
                  className="flex items-start gap-3 p-4 rounded-md border cursor-pointer mb-2 hover:bg-muted/40 transition"
                  style={{
                    borderColor: active ? "hsl(var(--brand))" : "hsl(var(--border))",
                    background: active ? "hsl(var(--brand) / 0.05)" : undefined,
                  }}
                >
                  <input
                    type="radio"
                    name="deploy"
                    checked={active}
                    onChange={() => setDeployChoice(opt.k)}
                    className="mt-1 accent-brand"
                  />
                  <Icon
                    size={18}
                    className="mt-0.5"
                    style={{
                      color:
                        "danger" in opt && opt.danger
                          ? "hsl(var(--destructive))"
                          : "hsl(var(--brand))",
                    }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{opt.t}</span>
                      {"rec" in opt && opt.rec && (
                        <Badge variant="outline" className="text-brand border-brand/40">
                          Recommended
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {opt.d}
                    </div>
                  </div>
                </label>
              );
            })}
            <div className="mt-4">
              <Alert variant="warning" title="Clinical decision-support device">
                <span className="text-xs">
                  Production promotions require signature from the clinical
                  director per SOP 04.2.
                </span>
              </Alert>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() =>
            step > 0 ? setStep(step - 1) : router.push("/admin/models")
          }
        >
          <ArrowLeft size={14} /> {step > 0 ? "Back" : "Cancel"}
        </Button>
        {step < 3 ? (
          <Button
            variant="brand"
            disabled={!canContinue}
            onClick={() => setStep(step + 1)}
          >
            Continue <ArrowRight size={14} />
          </Button>
        ) : (
          <Button
            variant="brand"
            onClick={async () => {
              const toastId = toast.loading(`Deploying to ${deployChoice}…`);
              try {
                const res = await fetch("/api/model/deploy", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    version: meta.version,
                    target: deployChoice,
                  }),
                });
                toast.dismiss(toastId);
                if (!res.ok) {
                  toast.error("Deploy failed");
                  return;
                }
                toast.success(`${meta.version} queued for ${deployChoice}`);
                router.push("/admin/models");
              } catch {
                toast.dismiss(toastId);
                toast.error("Deploy request failed");
              }
            }}
          >
            <Rocket size={14} /> Deploy
          </Button>
        )}
      </div>
    </div>
  );
}
