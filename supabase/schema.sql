-- DermaVision AI — Supabase schema snapshot
-- Generated 2026-05-11 against project ckugpjtouelfrhdziiya.
-- Source of truth is the live Supabase project; regenerate this file with
-- introspection queries (pg_get_functiondef, pg_get_triggerdef, etc.) when
-- migrations land.
--
-- The dump excludes:
--   - auth.* tables and policies (managed by Supabase Auth)
--   - storage.* policies (managed via the Supabase dashboard; documented at
--     the bottom of this file)
--
-- Replay order: extensions → tables → indexes → enable RLS → policies →
-- functions → triggers → cron.

-- ====================================================================
-- Extensions
-- ====================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- Tables
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text,
  role        text NOT NULL DEFAULT 'doctor'
                CHECK (role = ANY (ARRAY['doctor'::text, 'admin'::text])),
  created_at  timestamptz DEFAULT now(),
  suspended   boolean NOT NULL DEFAULT false,
  approved_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.user_details (
  id                   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name            text,
  specialty            text,
  phone                text,
  created_at           timestamptz DEFAULT now(),
  license              text,
  clinic_name          text,
  moh_facility_number  text,
  clinic_address       text,
  notification_prefs   jsonb NOT NULL DEFAULT
    '{"urgent": true, "newResults": true, "modelUpdates": true, "weeklyDigest": false}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.patients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  text UNIQUE NOT NULL,
  name        text NOT NULL,
  age         integer NOT NULL CHECK (age >= 0 AND age <= 120),
  sex         text NOT NULL CHECK (sex = ANY (ARRAY['male'::text, 'female'::text])),
  created_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesion_site     text NOT NULL,
  image_url       text,
  predicted_class text,
  confidence      numeric,
  probabilities   jsonb,
  gradcam_url     text,
  risk_level      text CHECK (
                    risk_level = ANY (ARRAY['High Risk'::text, 'Moderate Risk'::text, 'Benign'::text])
                  ),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status = ANY (ARRAY['pending'::text, 'complete'::text, 'reviewed'::text])),
  created_at      timestamptz DEFAULT now(),
  notes           text
);

CREATE TABLE IF NOT EXISTS public.reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  doctor_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sections    jsonb NOT NULL,
  format      text NOT NULL CHECK (format = ANY (ARRAY['pdf'::text, 'json'::text])),
  file_url    text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action        text NOT NULL,
  resource_type text,
  resource_id   uuid,
  metadata      jsonb,
  created_at    timestamptz DEFAULT now()
);

-- Archive table is structurally identical to audit_logs minus FK + defaults;
-- rows are moved here by archive_old_audit_logs() once they age past 90 days.
CREATE TABLE IF NOT EXISTS public.audit_logs_archive (
  id            uuid PRIMARY KEY,
  user_id       uuid,
  action        text NOT NULL,
  resource_type text,
  resource_id   uuid,
  metadata      jsonb,
  created_at    timestamptz
);

CREATE TABLE IF NOT EXISTS public.model_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version      text UNIQUE NOT NULL,
  status       text NOT NULL DEFAULT 'staging'
                 CHECK (status = ANY (ARRAY['staging'::text, 'production'::text, 'archived'::text])),
  architecture text,
  params       text,
  notes        text,
  onnx_path    text,
  deployed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.model_metrics (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id   uuid NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  metric_key   text NOT NULL,
  metric_value jsonb NOT NULL,
  captured_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_id, metric_key, captured_at)
);

CREATE TABLE IF NOT EXISTS public.inference_telemetry (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id    uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  version_id uuid REFERENCES public.model_versions(id) ON DELETE SET NULL,
  latency_ms integer NOT NULL CHECK (latency_ms >= 0),
  ts         timestamptz NOT NULL DEFAULT now()
);

-- ====================================================================
-- Indexes
-- ====================================================================
CREATE INDEX IF NOT EXISTS audit_logs_archive_created_idx
  ON public.audit_logs_archive USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS inference_telemetry_ts_idx
  ON public.inference_telemetry USING btree (ts DESC);
CREATE INDEX IF NOT EXISTS model_metrics_version_key_idx
  ON public.model_metrics USING btree (version_id, metric_key, captured_at DESC);
CREATE INDEX IF NOT EXISTS model_versions_status_idx
  ON public.model_versions USING btree (status);

-- ====================================================================
-- Row-Level Security
-- ====================================================================
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_details        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs_archive  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_versions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_metrics       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inference_telemetry ENABLE ROW LEVEL SECURITY;

-- audit_logs -----------------------------------------------------------
CREATE POLICY "Admins can read all audit logs" ON public.audit_logs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');
CREATE POLICY "Users can insert own audit logs" ON public.audit_logs
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- audit_logs_archive ---------------------------------------------------
CREATE POLICY audit_logs_archive_admin_read ON public.audit_logs_archive
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');

-- cases ----------------------------------------------------------------
CREATE POLICY "Admins can read all cases" ON public.cases
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');
CREATE POLICY "Doctors can manage own cases" ON public.cases
  AS PERMISSIVE FOR ALL TO authenticated
  USING (doctor_id = auth.uid())
  WITH CHECK (doctor_id = auth.uid());

-- inference_telemetry --------------------------------------------------
CREATE POLICY inference_telemetry_admin_read ON public.inference_telemetry
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');

-- model_metrics --------------------------------------------------------
CREATE POLICY model_metrics_admin_read ON public.model_metrics
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');

-- model_versions -------------------------------------------------------
CREATE POLICY model_versions_admin_read ON public.model_versions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');

-- patients -------------------------------------------------------------
CREATE POLICY "Admins can read all patients" ON public.patients
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');
CREATE POLICY "Doctors can manage own patients" ON public.patients
  AS PERMISSIVE FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- profiles -------------------------------------------------------------
CREATE POLICY "Admins can read all profiles" ON public.profiles
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');
CREATE POLICY "Admins update profiles" ON public.profiles
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "Users can read own profile" ON public.profiles
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- reports --------------------------------------------------------------
CREATE POLICY "Admins can read all reports" ON public.reports
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');
CREATE POLICY "Doctors can manage own reports" ON public.reports
  AS PERMISSIVE FOR ALL TO authenticated
  USING (doctor_id = auth.uid())
  WITH CHECK (doctor_id = auth.uid());

-- user_details ---------------------------------------------------------
CREATE POLICY "Admins can read all details" ON public.user_details
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');
CREATE POLICY "Admins insert user_details" ON public.user_details
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "Admins update all user_details" ON public.user_details
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "Users can insert own details" ON public.user_details
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "Users can read own details" ON public.user_details
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY "Users can update own details" ON public.user_details
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- ====================================================================
-- Functions (SECURITY DEFINER unless noted)
-- ====================================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
  RETURNS text
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  select role from public.profiles where id = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  meta_role text;
  is_invite boolean;
  final_role text;
BEGIN
  meta_role := new.raw_user_meta_data->>'role';
  is_invite := meta_role IS NOT NULL AND meta_role IN ('doctor', 'admin');
  final_role := CASE WHEN is_invite THEN meta_role ELSE 'doctor' END;

  INSERT INTO public.profiles (id, email, role, suspended, approved_at)
  VALUES (
    new.id,
    new.email,
    final_role,
    NOT is_invite,
    CASE WHEN is_invite THEN now() ELSE NULL END
  );

  INSERT INTO public.user_details (id, full_name, license)
  VALUES (
    new.id,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'license', '')
  );

  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_list()
  RETURNS TABLE(id uuid, role text, email text, last_sign_in_at timestamptz,
                created_at timestamptz, full_name text, scans_count bigint,
                suspended boolean, approved_at timestamptz)
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT p.id,
         p.role,
         u.email::text,
         u.last_sign_in_at,
         u.created_at,
         ud.full_name,
         COALESCE((SELECT count(*) FROM cases c WHERE c.doctor_id = p.id), 0) AS scans_count,
         p.suspended,
         p.approved_at
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN user_details ud ON ud.id = p.id
  WHERE get_my_role() = 'admin'
$function$;

CREATE OR REPLACE FUNCTION public.get_patient_records()
  RETURNS TABLE(patient_db_id uuid, patient_id text, name text, age integer, sex text,
                latest_case_id uuid, latest_predicted_class text, latest_confidence numeric,
                latest_risk_level text, latest_created_at timestamptz, scans_count bigint)
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
AS $function$
  SELECT
    p.id,
    p.patient_id,
    p.name,
    p.age,
    p.sex,
    latest.id,
    latest.predicted_class,
    latest.confidence,
    latest.risk_level,
    latest.created_at,
    COALESCE(cnt.c, 0)
  FROM patients p
  LEFT JOIN LATERAL (
    SELECT c.id, c.predicted_class, c.confidence, c.risk_level, c.created_at
    FROM cases c
    WHERE c.patient_id = p.id
    ORDER BY c.created_at DESC
    LIMIT 1
  ) latest ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::bigint AS c FROM cases c WHERE c.patient_id = p.id
  ) cnt ON true
  ORDER BY latest.created_at DESC NULLS LAST, p.created_at DESC
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_user_suspended(target uuid, v boolean)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF public.get_my_role() <> 'admin' THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles
    SET suspended = v,
        approved_at = CASE
          WHEN v = false AND approved_at IS NULL THEN now()
          ELSE approved_at
        END
    WHERE id = target;
END
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_user_role(target uuid, new_role text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF public.get_my_role() <> 'admin' THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF new_role NOT IN ('doctor','admin') THEN RAISE EXCEPTION 'bad role'; END IF;
  UPDATE public.profiles SET role = new_role WHERE id = target;
END
$function$;

CREATE OR REPLACE FUNCTION public.archive_old_audit_logs(retention_days integer DEFAULT 90)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  moved int;
BEGIN
  WITH cutoff AS (
    SELECT now() - (retention_days::text || ' days')::interval AS ts
  ),
  picked AS (
    DELETE FROM public.audit_logs
    WHERE created_at < (SELECT ts FROM cutoff)
    RETURNING *
  ),
  inserted AS (
    INSERT INTO public.audit_logs_archive
      (id, user_id, action, resource_type, resource_id, metadata, created_at)
    SELECT id, user_id, action, resource_type, resource_id, metadata, created_at
    FROM picked
    ON CONFLICT (id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO moved FROM inserted;
  RETURN moved;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_export_audit_logs(from_ts timestamptz, to_ts timestamptz)
  RETURNS TABLE(id uuid, user_id uuid, action text, resource_type text,
                resource_id uuid, metadata jsonb, created_at timestamptz)
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT id, user_id, action, resource_type, resource_id, metadata, created_at
  FROM public.audit_logs
  WHERE created_at >= from_ts AND created_at <= to_ts
    AND public.get_my_role() = 'admin'
  UNION ALL
  SELECT id, user_id, action, resource_type, resource_id, metadata, created_at
  FROM public.audit_logs_archive
  WHERE created_at >= from_ts AND created_at <= to_ts
    AND public.get_my_role() = 'admin'
  ORDER BY created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.latency_p50(window_days integer DEFAULT 7)
  RETURNS integer
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms)::integer,
    NULL
  )
  FROM public.inference_telemetry
  WHERE ts > now() - (window_days::text || ' days')::interval;
$function$;

CREATE OR REPLACE FUNCTION public.latency_quantiles(window_days integer DEFAULT 7)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  WITH samples AS (
    SELECT latency_ms, ts
    FROM public.inference_telemetry
    WHERE ts >= now() - make_interval(days => greatest(window_days, 1))
  ),
  agg AS (
    SELECT
      COALESCE(percentile_cont(0.5)  WITHIN GROUP (ORDER BY latency_ms), 0)::int AS p50,
      COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms), 0)::int AS p95,
      COALESCE(percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms), 0)::int AS p99,
      count(*)::int AS n
    FROM samples
  )
  SELECT jsonb_build_object(
    'p50_ms', a.p50,
    'p95_ms', a.p95,
    'p99_ms', a.p99,
    'count',  a.n,
    'window_days', greatest(window_days, 1),
    'throughput_per_hr',
      CASE WHEN a.n = 0 THEN 0
           ELSE round(a.n::numeric / (greatest(window_days, 1) * 24), 2)
      END
  )
  FROM agg a;
$function$;

CREATE OR REPLACE FUNCTION public.class_distribution(window_start timestamptz, window_end timestamptz)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    jsonb_object_agg(predicted_class, n),
    '{}'::jsonb
  )
  FROM (
    SELECT predicted_class, count(*)::int AS n
    FROM public.cases
    WHERE created_at >= window_start
      AND created_at <  window_end
      AND predicted_class IS NOT NULL
    GROUP BY predicted_class
  ) t;
$function$;

CREATE OR REPLACE FUNCTION public.class_distribution_daily(window_days integer)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH end_ts AS (
    SELECT date_trunc('day', now() AT TIME ZONE 'UTC') AS e
  ),
  per_day AS (
    SELECT
      date_trunc('day', c.created_at AT TIME ZONE 'UTC')::date AS day,
      c.predicted_class,
      count(*)::int AS n
    FROM public.cases c, end_ts
    WHERE c.created_at >= end_ts.e - make_interval(days => window_days)
      AND c.created_at <  end_ts.e
      AND c.predicted_class IS NOT NULL
    GROUP BY 1, 2
  ),
  bucketed AS (
    SELECT day, jsonb_object_agg(predicted_class, n) AS dist
    FROM per_day
    GROUP BY day
  )
  SELECT COALESCE(jsonb_object_agg(day::text, dist), '{}'::jsonb) FROM bucketed;
$function$;

GRANT EXECUTE ON FUNCTION public.class_distribution_daily(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.class_distribution_daily(int) TO authenticated;

-- ====================================================================
-- Triggers
-- ====================================================================
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- Cron (pg_cron)
-- ====================================================================
SELECT cron.schedule(
  'audit_logs_archive_daily',
  '0 3 * * *',
  $$ SELECT public.archive_old_audit_logs(90); $$
);

-- ====================================================================
-- Storage buckets (administered via the Supabase dashboard / Management API)
-- ====================================================================
-- Private buckets:
--   - dermoscopic-images
--   - heatmaps
--   - reports
--   - model-uploads
--
-- Policy shape for clinical buckets (dermoscopic-images, heatmaps, reports):
--   Doctor: storage.foldername(name)[1] = auth.uid()::text
--   Admin:  get_my_role() = 'admin' (read-all overlay)
-- model-uploads is admin-only on every action.
