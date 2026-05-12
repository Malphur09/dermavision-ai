# Architecture

## Topology

```
Browser ─┐
         │ http://localhost:3000
         ▼
   ┌────────────┐  internal docker network    ┌──────────────┐
   │  Next.js   │  http://api:5328            │   Flask API  │
   │  16 (App   │ ─────────────────────────▶  │   gunicorn   │
   │   Router)  │   /api/* rewrite             │   PyTorch    │
   └─────┬──────┘                              └──────┬───────┘
         │ supabase-js (browser singleton)            │ service-role REST
         │ supabase-ssr (server)                      │ HTTP via api/supabase.py
         ▼                                            ▼
   ┌────────────────────────────────────────────────────────┐
   │                       Supabase                          │
   │  Auth (SSR cookies) · Postgres+RLS · Storage · pg_cron  │
   └────────────────────────────────────────────────────────┘
```

## Request flow

1. Browser hits Next.js at `:3000`. Auth state is read from Supabase SSR cookies. Middleware (`src/proxy.ts`) gates `(authed)/*` routes and bounces suspended / pending users.
2. Almost every read goes **straight from the browser to Supabase** with the user's JWT — RLS enforces ownership. The frontend uses a singleton `createBrowserClient` (`src/lib/supabase/client.ts`) so all components share the same auth lock.
3. The Flask backend is reserved for: ML inference, PDF rendering, admin proxies that need service-role privileges, and lifecycle endpoints. `next.config.ts` rewrites `/api/*` to `FLASK_INTERNAL_URL` so the frontend never talks to Flask directly across the public network.
4. Flask never touches user data with the service-role key on read paths it doesn't have to. It either:
   - forwards the caller's bearer token (`api/reports.py`, `api/auth.py`) so RLS does the work, or
   - uses the service role for admin-only writes / metrics ingestion (`api/admin.py`, `api/metrics.py`, `api/model_lifecycle.py`).

## Auth + roles

- Provider: Supabase Auth.
- Roles in `public.profiles.role`: `doctor`, `admin`. Enforced by `get_my_role()` SECURITY DEFINER helper.
- Flags on `profiles`:
  - `approved_at` — null means the signup is pending an admin approval.
  - `suspended` — true means the user is blocked; middleware signs them out.
- Sign-up trigger `handle_new_user()` (on `auth.users` insert) creates matching `profiles` + `user_details` rows. Invited users (`raw_user_meta_data.role` set) land approved and active; self-signups land pending.
- Admin-only RPCs: `admin_set_user_suspended`, `admin_update_user_role`, `admin_export_audit_logs`.
- Admin-only Flask proxies: `/api/admin/invite`, `/api/admin/reset-mfa`.

## Key files

```
src/
├── app/
│   ├── (authed)/layout.tsx     # nav config (doctor / admin)
│   ├── login/                   # auth screen + reset flow
│   └── …                        # one route per page (thin wrappers)
├── components/
│   ├── AdminDashboard.tsx       # composes admin/* subcomponents
│   ├── DiagnosticInput.tsx      # composes diagnostic/* subcomponents
│   ├── DiagnosisResults.tsx     # composes results/* subcomponents
│   ├── AppShell.tsx             # sidebar nav, model card
│   └── admin|diagnostic|results # extracted subcomponents per page
├── contexts/                    # AuthContext, ThemeContext
└── lib/
    ├── api-types.ts             # shared TS shapes for Flask responses
    ├── audit.ts                 # logPhiAccess helper
    ├── isic-classes.ts          # presentation constants + canonical class list
    └── supabase/                # singleton browser + server clients

api/
├── index.py                     # Flask app factory, /predict, /gradcam
├── pth_backend.py               # native PyTorch ensemble + bespoke Grad-CAM
├── backend.py                   # onnxruntime / onnx2torch fallback for uploads
├── preprocess.py                # image preprocessing (shared)
├── metrics.py                   # /api/metrics/*, /api/model/versions
├── model_lifecycle.py           # /api/model/upload/*, /api/model/deploy,
│                                # PATCH /api/model/versions/<id>
├── reports.py                   # PDF/JSON export via WeasyPrint
├── drift.py                     # PSI drift window
├── eval_set.py                  # bucket-backed eval-set loader + evaluate()
├── auth.py + admin.py           # caller-token + service-role proxies
├── supabase.py                  # shared HTTP helpers (rest_get/post/patch, storage_*, rpc)
├── classes.py                   # canonical ISIC class list
└── tests/                       # pytest suite

supabase/
└── schema.sql                   # DDL snapshot
```

## Frontend conventions

- `(authed)/layout.tsx` defines `doctorNav` and `adminNav`. To add a route, add a row and create the page under `src/app/(authed)/…`.
- The sidebar highlights the **longest** matching nav prefix, so `/admin` (Users) and `/admin/audit` (Audit log) don't both light up.
- Shared API response shapes live in `src/lib/api-types.ts`. When a Flask endpoint changes, update the type here and TS will catch every consumer.
- Toasts use `sonner`. The wrapper (`src/components/ui/sonner.tsx`) binds to Tailwind `bg-popover` so the background is opaque — never put raw HSL component strings into the sonner CSS vars.

## Backend conventions

- Flask is ML-only. Do not add auth, user-data CRUD, or business logic that could live on the browser via RLS.
- All service-role Supabase calls go through `api/supabase.py`. Failures log at WARNING via the `api.supabase` logger — don't add `try / except: pass` around HTTP elsewhere.
- Class ordering is load-bearing. `api/classes.py` is the only source of truth; argmax against it is what maps softmax outputs to predicted class labels.
- `reports.py` is the exception to the service-role rule — it forwards the user JWT and uses `_user_headers` so RLS continues to enforce ownership during report export.
- Lifecycle endpoints update production via the `model_versions` table only. Workers poll that table every 60s and hot-swap the ONNX bytes when `onnx_path` changes — no SIGHUP, no flag files.
