# Setup

End-to-end bring-up for a fresh clone. Assumes you have Docker, a Supabase project, and the production `.pth` model file.

## 1. Repo + env

```bash
git clone https://github.com/Malphur09/dermavision-ai.git
cd dermavision-ai
cp .env.example .env
```

Required keys in `.env`:

| Key | Source | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings → API → Project URL | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase API → anon public | |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase API → service_role | **Verify JWT claim `role: service_role`** — pasting the anon key by mistake makes `/api/admin/*` return 403. |
| `FLASK_INTERNAL_URL` | optional | Defaults to `http://api:5328` in Docker. |

Optional:

| Key | Default | Purpose |
|---|---|---|
| `PTH_MODEL_PATH` | `/models/dermavision_ensemble_3way.pth` | Native PyTorch ensemble path inside the container. |
| `PTH_HOST_DIR` | `${HOME}/code/dataset` | Host dir mounted read-only as `/models`. |
| `MODEL_PATH` | `efficientnetb4_isic2019.onnx` | ONNX fallback when no `.pth` is present. |

## 2. Apply the schema

The repo ships `supabase/schema.sql` (DDL only). Pick one:

```bash
# Option A — supabase CLI (if linked to project)
supabase db reset --linked      # nukes the project! use db push for incremental
supabase db push                # against current migrations dir

# Option B — psql against the project's connection string
psql "$(supabase projects api-keys --project-ref <REF> --format json | jq -r .db_url)" \
  -f supabase/schema.sql

# Option C — MCP / dashboard SQL editor: paste the file contents and run
```

What lands: 10 public tables (`profiles`, `user_details`, `patients`, `cases`, `reports`, `audit_logs`, `audit_logs_archive`, `model_versions`, `model_metrics`, `inference_telemetry`), RLS enabled with all policies, 12 SECURITY DEFINER functions, the `handle_new_user` trigger on `auth.users`, and the `audit_logs_archive_daily` pg_cron job.

## 3. Create storage buckets

Run in the Supabase SQL editor (no DDL equivalent for storage):

```sql
insert into storage.buckets (id, name, public) values
  ('dermoscopic-images', 'dermoscopic-images', false),
  ('heatmaps',           'heatmaps',           false),
  ('reports',            'reports',            false),
  ('model-uploads',      'model-uploads',      false)
on conflict (id) do nothing;
```

Policies for clinical buckets (per-user folder + admin read-all overlay):

```sql
-- dermoscopic-images / heatmaps / reports
create policy "Doctor folder access" on storage.objects
  for all to authenticated
  using (
    bucket_id in ('dermoscopic-images', 'heatmaps', 'reports')
    and storage.foldername(name)[1] = auth.uid()::text
  )
  with check (
    bucket_id in ('dermoscopic-images', 'heatmaps', 'reports')
    and storage.foldername(name)[1] = auth.uid()::text
  );

create policy "Admin read all clinical buckets" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('dermoscopic-images', 'heatmaps', 'reports')
    and public.get_my_role() = 'admin'
  );

-- model-uploads (admin-only, every action)
create policy "Admin manages model-uploads" on storage.objects
  for all to authenticated
  using (bucket_id = 'model-uploads' and public.get_my_role() = 'admin')
  with check (bucket_id = 'model-uploads' and public.get_my_role() = 'admin');
```

## 4. Drop in the model artifact

The PyTorch ensemble is `dermavision_ensemble_3way.pth` (~505 MB). Get it from the model team's storage and put it where docker-compose expects:

```bash
mkdir -p ~/code/dataset
cp /path/to/dermavision_ensemble_3way.pth ~/code/dataset/
# or override PTH_HOST_DIR in .env to point at wherever you stashed it
```

Optional: drop `efficientnetb4_isic2019.onnx` at repo root if you want the v1.0 ONNX fallback for benchmarks.

## 5. Bring it up

```bash
docker compose up --build
```

- Web → http://localhost:3000
- Flask → only inside the compose network at `http://api:5328`

Look for these lines in `docker compose logs api`:

```
[INFO] PTH model loaded: /models/dermavision_ensemble_3way.pth (PthBackend)
[INFO] Active model input size: 384x384; gradcam=bespoke
```

If you see `[WARNING] PTH load failed`, check `PTH_MODEL_PATH` and the mount.

## 6. First admin

Sign up at `/login` (lands as pending). Then promote yourself from the Supabase SQL editor:

```sql
update public.profiles
set role = 'admin',
    approved_at = now(),
    suspended = false
where email = 'you@example.com';
```

Sign in. From there invite the rest of the team via Admin → Users → Invite (uses `/api/admin/invite` with the service-role key).

## 7. Smoke test

- `/diagnostic` → upload a dermoscopic image → results page renders prediction + heatmap.
- `/dashboard` → KPIs populated. If `synthetic: true` appears in `/api/metrics/summary`, you forgot step 2 or step 6.
- `/admin/audit` → at least one `viewed` event from the diagnosis run above.

## Tests

```bash
docker compose exec api pytest api/tests   # 46 backend tests
npm test                                   # 17 vitest specs
npm run lint
npm run build
```
