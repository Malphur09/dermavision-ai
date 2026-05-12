# Development

## Local dev with docker (preferred)

```bash
docker compose up --build       # build first time, then `docker compose up` is enough
docker compose logs -f api      # tail Flask logs
docker compose exec api bash    # shell into the api container
docker compose down             # stop everything
```

The compose file mounts the repo as `/app` in both containers and uses `gunicorn --reload`, so code edits hot-reload without rebuilding. The `.pth` artifact is mounted read-only from `$PTH_HOST_DIR` (default `~/code/dataset`) into `/models`.

## Local dev without docker

Backend:

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
export PTH_MODEL_PATH=$HOME/code/dataset/dermavision_ensemble_3way.pth
venv/bin/flask --app api/index run -p 5328
```

Frontend (separate shell):

```bash
npm install
npm run dev:web                 # next dev on :3000
```

`next.config.ts` falls back to `http://127.0.0.1:5328` when `FLASK_INTERNAL_URL` is unset, so the proxy works for the local-shell case too.

## Tests

| Command | What it covers |
|---|---|
| `docker compose exec api pytest api/tests` | 46 backend tests — REST helpers, drift math, metrics endpoints, model lifecycle, eval-set parsing |
| `docker compose exec api pytest api/tests -q -k <pattern>` | filter |
| `npm test` | 17 vitest specs — admin/* and results/* subcomponents, supabase singleton, audit helper |
| `npm run test:watch` | vitest watch mode |
| `npm run lint` | ESLint (next-config) |
| `npm run build` | next build — typecheck + prerender 18 routes |

CI runs all four on every push (`.github/workflows/ci.yml`).

## Commit conventions

- Plain prefixes: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`, `ux:`. No scope parens.
- No `Co-Authored-By` trailers, no AI footers.
- One concern per commit; keep them small enough that the message body is optional.
- Body is wrapped to ~72 chars when present and answers "why," not "what."
- Branching: work on `dev`. Merge `dev` → `main` via PR when ready.

## Regenerating `supabase/schema.sql`

Run the introspection queries (see this codebase's chat history for the working set) — they emit DDL for tables, indexes, RLS, functions, triggers, and the pg_cron job. Concatenate the outputs into `supabase/schema.sql`. Storage policies are documented in `docs/setup.md` rather than dumped, because PostgREST/PostgreSQL don't have a clean roundtrip for storage policies.

Sanity check: `psql -f supabase/schema.sql` against a blank database should run end-to-end with no errors.

## Common gotchas

- **403 on `/api/admin/*`** — `SUPABASE_SERVICE_ROLE_KEY` is set to the **anon** key. Decode the JWT and check the `role` claim — must be `service_role`.
- **AdminDashboard tiles flash `synthetic: true`** — no `model_versions` row marked `production`. Apply `supabase/schema.sql` and seed the v1.1 row.
- **`supabase.auth.updateUser()` hangs forever** — known browser-client lock contention. Use the Flask proxy `POST /api/auth/change-password` instead (already wired in `Settings.tsx` + `/reset-password`).
- **Grad-CAM toast says "unavailable for this model (ORT backend)"** — the currently loaded model is an ONNX that onnx2torch couldn't convert. Either re-export with a friendlier opset or mount the `.pth` ensemble (`PTH_MODEL_PATH`).
- **`react-hooks/exhaustive-deps` warnings on data-fetch effects** — wrap the fetcher in `useCallback([])` and add it to the deps. ModelVersions does this for `loadVersions`.

## Seeding demo data

```bash
docker compose exec api python scripts/seed_demo_data.py \
  --doctor <doctor-uuid> --patients 8 --cases 14 --clean --gradcam
```

Idempotent via `--clean`. Patient IDs prefixed `SEED-` so the cleanup pattern stays narrow. Uses real ISIC images from `/models/ISIC_2019_Test_Input` and runs the actual PthBackend to produce honest predictions + heatmaps.

## Hot-reloading the production model

If you replace `~/code/dataset/dermavision_ensemble_3way.pth`, restart the api container:

```bash
docker compose restart api
```

There's no on-disk watcher for the `.pth` side-car. Hot reload only triggers when `model_versions.onnx_path` changes (covered by the upload-wizard deploy flow, not relevant when `PTH_MODEL_PATH` is set).
