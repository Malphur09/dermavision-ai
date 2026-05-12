import { Alert } from "@/components/primitives/Alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ANATOMICAL_SITES, type Patient } from "./constants";
import { PatientPicker } from "./PatientPicker";

export interface CaseDetailsSidebarProps {
  patients: Patient[];
  isNewPatient: boolean;
  setIsNewPatient: (v: (prev: boolean) => boolean) => void;
  selectedPatientDbId: string;
  setSelectedPatientDbId: (v: string) => void;
  newPatientId: string;
  setNewPatientId: (v: string) => void;
  newPatientName: string;
  setNewPatientName: (v: string) => void;
  newAge: string;
  setNewAge: (v: string) => void;
  newSex: string;
  setNewSex: (v: string) => void;
  lesionSite: string;
  setLesionSite: (v: string) => void;
  clinicalNotes: string;
  setClinicalNotes: (v: string) => void;
  errors: Record<string, string>;
  clearErr: (field: string) => void;
}

export function CaseDetailsSidebar(props: CaseDetailsSidebarProps) {
  const { lesionSite, setLesionSite, clinicalNotes, setClinicalNotes, errors, clearErr } = props;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="font-semibold mb-4">Case details</h3>

      <div className="space-y-4">
        <PatientPicker {...props} />

        <div>
          <Label>Anatomical site</Label>
          <Select
            value={lesionSite}
            onValueChange={(v) => {
              setLesionSite(v);
              clearErr("lesionSite");
            }}
          >
            <SelectTrigger
              aria-invalid={!!errors.lesionSite}
              className="mt-1 w-full"
            >
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {ANATOMICAL_SITES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.lesionSite && (
            <p className="mt-1 text-xs text-destructive">{errors.lesionSite}</p>
          )}
        </div>

        <div>
          <Label htmlFor="notes">Clinical notes</Label>
          <Textarea
            id="notes"
            value={clinicalNotes}
            onChange={(e) => setClinicalNotes(e.target.value)}
            placeholder="Any relevant history or observations…"
            className="mt-1 h-20 resize-y"
          />
        </div>

        <Alert variant="info" title="Decision support only">
          <span className="text-xs">
            All predictions require clinician review and are not a diagnosis.
          </span>
        </Alert>
      </div>
    </div>
  );
}
