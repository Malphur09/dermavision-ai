import { Plus } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Patient } from "./constants";

export interface PatientPickerProps {
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
  errors: Record<string, string>;
  clearErr: (field: string) => void;
}

export function PatientPicker({
  patients,
  isNewPatient,
  setIsNewPatient,
  selectedPatientDbId,
  setSelectedPatientDbId,
  newPatientId,
  setNewPatientId,
  newPatientName,
  setNewPatientName,
  newAge,
  setNewAge,
  newSex,
  setNewSex,
  errors,
  clearErr,
}: PatientPickerProps) {
  const selectedPatient = patients.find((p) => p.id === selectedPatientDbId);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label>Patient</Label>
        <button
          type="button"
          onClick={() => {
            setIsNewPatient((p) => !p);
            clearErr("patient");
          }}
          className="text-xs text-brand inline-flex items-center gap-1"
        >
          <Plus size={10} />
          {isNewPatient ? "Use existing" : "New patient"}
        </button>
      </div>

      {!isNewPatient ? (
        <>
          <Select
            value={selectedPatientDbId}
            onValueChange={(v) => {
              setSelectedPatientDbId(v);
              clearErr("patient");
            }}
          >
            <SelectTrigger
              aria-invalid={!!errors.patient}
              className="w-full"
            >
              <SelectValue placeholder="Select patient" />
            </SelectTrigger>
            <SelectContent>
              {patients.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  No patients yet
                </div>
              )}
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} · {p.patient_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPatient && (
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span>
                {selectedPatient.age ?? "—"} · {selectedPatient.sex ?? "—"}
              </span>
            </div>
          )}
          {errors.patient && (
            <p className="mt-1 text-xs text-destructive">{errors.patient}</p>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div>
            <Label htmlFor="np-id" className="text-xs">
              Patient ID
            </Label>
            <Input
              id="np-id"
              placeholder={`PT-${new Date().getFullYear()}-001`}
              value={newPatientId}
              onChange={(e) => {
                setNewPatientId(e.target.value);
                clearErr("newPatientId");
              }}
              aria-invalid={!!errors.newPatientId}
              className="mt-1"
            />
            {errors.newPatientId && (
              <p className="mt-1 text-xs text-destructive">
                {errors.newPatientId}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="np-name" className="text-xs">
              Name
            </Label>
            <Input
              id="np-name"
              value={newPatientName}
              onChange={(e) => {
                setNewPatientName(e.target.value);
                clearErr("newPatientName");
              }}
              aria-invalid={!!errors.newPatientName}
              className="mt-1"
            />
            {errors.newPatientName && (
              <p className="mt-1 text-xs text-destructive">
                {errors.newPatientName}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="np-age" className="text-xs">
                Age
              </Label>
              <Input
                id="np-age"
                type="number"
                value={newAge}
                onChange={(e) => {
                  setNewAge(e.target.value);
                  clearErr("newAge");
                }}
                aria-invalid={!!errors.newAge}
                className="mt-1"
              />
              {errors.newAge && (
                <p className="mt-1 text-xs text-destructive">{errors.newAge}</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Sex</Label>
              <Select
                value={newSex}
                onValueChange={(v) => {
                  setNewSex(v);
                  clearErr("newSex");
                }}
              >
                <SelectTrigger
                  aria-invalid={!!errors.newSex}
                  className="mt-1 w-full"
                >
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
              {errors.newSex && (
                <p className="mt-1 text-xs text-destructive">{errors.newSex}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
