import { Ref } from "react";
import {
  CheckCircle,
  Clock,
  Image as ImageIcon,
  Lock,
  Shield,
  Sparkles,
  Upload as UploadIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import type { Step } from "./constants";

export interface UploadDropzoneProps {
  step: Step;
  uploadedFile: File | null;
  progress: number;
  dragging: boolean;
  isProcessing: boolean;
  fileInputRef: Ref<HTMLInputElement>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent) => void;
  setDragging: (v: boolean) => void;
  openFileDialog: () => void;
  runAnalysis: () => void;
  resetUpload: () => void;
}

export function UploadDropzone({
  step,
  uploadedFile,
  progress,
  dragging,
  isProcessing,
  fileInputRef,
  onFileChange,
  onDrop,
  setDragging,
  openFileDialog,
  runAnalysis,
  resetUpload,
}: UploadDropzoneProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={onFileChange}
        className="hidden"
      />

      {step === "select" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={openFileDialog}
          className="flex flex-col items-center justify-center rounded-md cursor-pointer transition"
          style={{
            border: `2px dashed ${
              dragging ? "hsl(var(--brand))" : "hsl(var(--border))"
            }`,
            background: dragging
              ? "hsl(var(--brand) / 0.05)"
              : "hsl(var(--muted) / 0.3)",
            minHeight: 360,
            padding: 40,
            textAlign: "center",
          }}
        >
          <div
            className="p-4 rounded-full mb-4"
            style={{
              background: "hsl(var(--brand) / 0.1)",
              color: "hsl(var(--brand))",
            }}
          >
            <UploadIcon size={28} />
          </div>
          <h3 className="text-lg font-semibold mb-1">Drop image here</h3>
          <p className="text-sm text-muted-foreground mb-6">
            or click to browse · JPG, PNG · max 10 MB
          </p>
          <div className="flex items-center gap-2">
            <Button variant="brand" type="button">
              <ImageIcon size={14} /> Choose file
            </Button>
          </div>
          <div className="flex items-center gap-6 mt-8 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Shield size={12} /> HIPAA encrypted
            </div>
            <div className="flex items-center gap-1.5">
              <Lock size={12} /> Private to clinic
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={12} /> ~340ms inference
            </div>
          </div>
        </div>
      )}

      {step === "uploading" && (
        <div
          className="flex flex-col items-center justify-center"
          style={{ minHeight: 360 }}
        >
          <div className="w-full max-w-md">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium truncate mr-2">
                {uploadedFile?.name}
              </span>
              <span className="mono text-muted-foreground">
                {Math.floor(progress)}%
              </span>
            </div>
            <Progress value={progress} />
            <div className="text-xs text-muted-foreground mt-2 mono">
              {progress < 50
                ? "Uploading…"
                : progress < 95
                  ? "Preprocessing · normalizing"
                  : "Ready for inference…"}
            </div>
          </div>
        </div>
      )}

      {step === "ready" && uploadedFile && (
        <div
          className="flex flex-col items-center justify-center"
          style={{ minHeight: 360 }}
        >
          <div className="flex items-center gap-2 text-sm mb-4">
            <CheckCircle size={16} style={{ color: "hsl(var(--success))" }} />
            <span className="font-medium">
              {uploadedFile.name} · {(uploadedFile.size / 1024).toFixed(1)} KB
            </span>
          </div>
          <div className="text-xs text-muted-foreground mb-6">
            Ready to analyze
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="brand"
              size="lg"
              onClick={runAnalysis}
              disabled={isProcessing}
            >
              <Sparkles size={14} />{" "}
              {isProcessing ? "Running analysis…" : "Run analysis"}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={resetUpload}
              disabled={isProcessing}
            >
              Replace image
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
