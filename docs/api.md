# API

All endpoints under `/api/*`. Next.js rewrites the prefix to `FLASK_INTERNAL_URL` (default `http://api:5328`). Auth surfaces require a Supabase Bearer JWT in `Authorization`.

## Core ML

### `GET /api/health`
Public. `{ status: "ok", model_loaded: bool }`.

### `POST /api/predict`
Auth: `@require_user`. Rate-limited 30/min per user. Multipart `file=<jpeg|png>`. Returns:

```json
{
  "predicted_class": "Melanoma",
  "probabilities": { "Melanoma": 0.87, "Melanocytic Nevus": 0.07, ... }
}
```

Writes a non-blocking `inference_telemetry` row with the measured latency (used by drift + the p50/p95/p99 RPCs).

### `POST /api/gradcam`
Auth: `@require_user`. Rate-limited 15/min per user. Multipart `file=<jpeg|png>`. Returns:

```json
{ "heatmap": "data:image/png;base64,…", "message": "ok" }
```

If the active backend is ORT (no autograd) or generation fails, returns `{ heatmap: null, message: "…why…" }` with HTTP 200 — the frontend surfaces the message as a toast.

## Reports

### `POST /api/reports/export`
Auth: `@require_user`. JSON body: `{ case_id, format: "pdf"|"json", sections: { patientInfo, diagnosisResults, gradCAM, technicalDetails } }`. Returns:

```json
{
  "report_id": "uuid",
  "format": "pdf",
  "file_url": "doctor_id/uuid.pdf",
  "signed_url": "https://.../storage/v1/object/sign/...?token=..."
}
```

Renders via WeasyPrint when `format=pdf`. Forwards the user's JWT to Supabase Storage so RLS enforces ownership.

## Metrics + version

All read endpoints fall back to deterministic synthetic numbers when no row exists (`synthetic: true` in the response).

| Endpoint | Auth | Returns |
|---|---|---|
| `GET /api/metrics/summary` | none | `{ version, balanced_acc, macro_f1, accuracy, weighted_f1, macro_auc_ovr, p50_latency_ms, last_trained_at, previous? }` |
| `GET /api/metrics/per_class` | none | `{ classes: [{code, full, f1, precision, recall, support}, ...] }` |
| `GET /api/metrics/confusion` | none | `{ classes: [...], matrix: number[][] }` |
| `GET /api/metrics/drift` | none | `{ window: 30, values: number[] }` — PSI vs eval-set reference |
| `GET /api/metrics/latency` | none | `{ p50_ms, p95_ms, p99_ms, count, window_days, throughput_per_hr }` |
| `GET /api/metrics/training_curves` | none | synthetic only — no real training logs are ingested |
| `GET /api/model/versions` | none | `{ versions: [{ id, version, status, architecture, params, notes, date, accuracy }] }` |
| `PATCH /api/model/versions/<id>` | `@require_admin` | Body: `{ version?, architecture?, params?, notes? }` |

## Model lifecycle (admin only)

| Endpoint | Body | Effect |
|---|---|---|
| `POST /api/model/upload/validate` | `{ path }` | ONNX checker + shape verify (`(1,3,H,W)` → `(1,8)`) |
| `POST /api/model/upload/benchmark` | `{ path }` | Convert via onnx2torch (ORT fallback), 20 forward passes, return real p50/p95 + accuracy/F1 if eval-set provisioned |
| `POST /api/model/deploy` | `{ path, version, target, architecture, notes, benchmark }` | Insert version, archive prior production, copy artifact, ingest `metrics.json` into `model_metrics`, invalidate drift cache |

## Admin proxies

| Endpoint | Body | Effect |
|---|---|---|
| `POST /api/admin/invite` | `{ email, role }` | Calls Supabase Admin Auth `/auth/v1/invite` with service-role key |
| `POST /api/admin/reset-mfa` | `{ user_id }` | Lists + deletes all MFA factors on the target user |

Suspend / role-change happen directly via `admin_set_user_suspended` and `admin_update_user_role` RPCs from `AdminManagement.tsx` — no Flask hop needed.

## User self-service

| Endpoint | Body | Effect |
|---|---|---|
| `POST /api/auth/change-password` | `{ password }` | Forwards user JWT to Supabase `PUT /auth/v1/user`. Exists to bypass the browser-client `navigator.locks` hang on `supabase.auth.updateUser()`. |

## Bearer token contract

The frontend grabs the access token via `supabase.auth.getSession()`, passes it as `Authorization: Bearer <jwt>`. Flask validates via:

- `@require_user` (`api/_auth.py`) — accepts any signed-in user, injects `{ user, token }` into `request.environ["caller"]`.
- `@require_admin` (`api/_auth.py`) — validates the JWT then checks `profiles.role = 'admin'` with the service-role client. Returns 403 if the env var is the anon key by mistake.

## Stable contracts

These response shapes are part of the public contract — the frontend depends on them:

```
GET  /api/health
POST /api/predict          → { predicted_class, probabilities }
POST /api/gradcam          → { heatmap, message }
POST /api/reports/export   → { report_id, format, file_url, signed_url }
```

Anything else can evolve, but version changes should ship with both backend and frontend.
