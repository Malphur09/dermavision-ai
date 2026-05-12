# Database

Supabase Postgres. Schema snapshot lives at `supabase/schema.sql`. Authoritative state is the live project — regenerate the snapshot when migrations land.

## Tables (public, RLS on every one)

| Table | Rows | Purpose |
|---|---|---|
| `profiles` | one per auth.users | role + suspended/approved flags + email |
| `user_details` | one per auth.users | full name, license, clinic info, notification prefs |
| `patients` | one per patient | demographics + `created_by` doctor |
| `cases` | one per scan | image_url, gradcam_url, predicted_class, probabilities (jsonb), confidence, risk_level, status |
| `reports` | one per export | case_id + sections (jsonb) + format + signed file_url |
| `audit_logs` | hot 90-day window | PHI access events |
| `audit_logs_archive` | older than 90 days | filled by `archive_old_audit_logs(days)` |
| `model_versions` | one per deployed/staged model | status, architecture, onnx_path, deployed_at |
| `model_metrics` | many per version | keyed by `metric_key` (`summary`, `per_class`, `confusion`, `drift`, `training_curves`) |
| `inference_telemetry` | one per predict call | latency_ms + version_id (used by p50/p95/p99 + drift) |

Foreign keys cascade to children — deleting a patient removes their cases/reports.

## RLS strategy

Three patterns, applied uniformly:

1. **Doctor self-scope** — `cases`, `patients`, `reports`: `using (doctor_id = auth.uid())` / `using (created_by = auth.uid())`. Doctors only see their own rows.
2. **Admin overlay** — every table has a SELECT policy `using (get_my_role() = 'admin')` that gives admins read-all without disabling RLS.
3. **Self-row access** — `profiles`, `user_details` allow the row owner to SELECT/UPDATE their own row.

`get_my_role()` is a SECURITY DEFINER helper — calling it from RLS quals avoids the recursive-policy footgun.

## Audit retention

- Hot table (`audit_logs`) keeps the last 90 days.
- pg_cron job `audit_logs_archive_daily` runs `archive_old_audit_logs(90)` nightly at 03:00 UTC.
- Admin CSV export uses `admin_export_audit_logs(from_ts, to_ts)` which unions hot + archive transparently.
- `logPhiAccess` (`src/lib/audit.ts`) fires from the browser on `DiagnosisResults` mount, `PatientRecords` row click, `ReportGeneration` export, and `DiagnosisResults` mark-reviewed / reopen.

## SECURITY DEFINER functions

| Function | Purpose |
|---|---|
| `get_my_role()` | role of the calling user — used in RLS qualifiers |
| `handle_new_user()` | trigger on `auth.users` — creates profiles + user_details, lands self-signups as pending |
| `get_user_list()` | admin-only — joins profiles + auth.users + user_details + scans_count |
| `get_patient_records()` | doctor-or-admin — patients + their latest case via LATERAL joins |
| `admin_set_user_suspended(target, v)` | admin-only — flips suspended flag, stamps approved_at |
| `admin_update_user_role(target, new_role)` | admin-only — checks role IN ('doctor','admin') |
| `archive_old_audit_logs(retention_days = 90)` | nightly cron — moves rows from hot to archive |
| `admin_export_audit_logs(from_ts, to_ts)` | admin-only — union hot + archive for CSV export |
| `latency_p50(window_days = 7)` | p50 latency over `inference_telemetry` |
| `latency_quantiles(window_days = 7)` | `{ p50_ms, p95_ms, p99_ms, count, throughput_per_hr }` |
| `class_distribution(window_start, window_end)` | per-class predicted counts in a window |
| `class_distribution_daily(window_days)` | per-day distribution buckets for the drift query — one RPC instead of 30 |

## Indexes

| Index | Purpose |
|---|---|
| `audit_logs_archive_created_idx (created_at DESC)` | export queries that span archive |
| `inference_telemetry_ts_idx (ts DESC)` | latency RPCs |
| `model_metrics_version_key_idx (version_id, metric_key, captured_at DESC)` | `_get_metric` lookups |
| `model_metrics_version_id_metric_key_captured_at_key` UNIQUE | dedupe identical metric ingests |
| `model_versions_status_idx (status)` | "active production row" query in metrics + lifecycle |
| `model_versions_version_key` UNIQUE | enforce version-string uniqueness |
| `patients_patient_id_key` UNIQUE | enforce PT-ID uniqueness across the project |

## Storage buckets (private)

| Bucket | Used for | Policy summary |
|---|---|---|
| `dermoscopic-images` | original lesion images | per-doctor folder + admin read-all |
| `heatmaps` | Grad-CAM overlays | per-doctor folder + admin read-all |
| `reports` | exported PDFs / JSON | per-doctor folder + admin read-all |
| `model-uploads` | staged + production ONNX artifacts | admin-only for every action |

The policies aren't part of the `schema.sql` snapshot — see `docs/setup.md` for the SQL to recreate them.

## Migrations

Tracked migrations (`supabase_migrations.schema_migrations`):

```
20260420 — initial table bootstraps (buckets, RLS, user details)
20260421 — admin_ops RPC bundle
20260422 — get_patient_records
20260424 — clinical-facility renames, sex enum tighten, suspend/approved split,
           model_versions/model_metrics/inference_telemetry, latency_p50
20260504 — audit retention + admin_export_audit_logs + pg_cron
20260507 — class_distribution + latency_quantiles
20260511 — class_distribution_daily (batched drift query)
```

When you add a new migration via `mcp__supabase__apply_migration` or `supabase migration new`, regenerate `supabase/schema.sql` (see `docs/development.md`).
