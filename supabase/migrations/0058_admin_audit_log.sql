-- Admin Audit Log
-- Replaces the decorative admin_notifications view with a proper audit log table.
-- Every CRUD action and auth event performed by admins is captured here.

-- 1. Drop the old notifications view (backed by service_requests; obsolete).
DROP VIEW IF EXISTS public.admin_notifications;

-- 2. Create the audit log table.
CREATE TABLE public.admin_audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  barangay_id uuid        REFERENCES public.barangays(id),
  admin_id    uuid        REFERENCES auth.users(id),
  action      TEXT        NOT NULL,       -- 'create' | 'update' | 'delete' | 'status_change' | 'login' | 'logout'
  entity_type TEXT        NOT NULL,       -- see AdminEntityType in shared schema
  entity_id   uuid,                       -- nullable for login/logout system events
  entity_label TEXT,                      -- human-readable summary, e.g. "Request #REQ-001"
  changes     JSONB,                      -- optional diff: { before: {...}, after: {...} }
  metadata    JSONB,                      -- extra context (reference_number, status, etc.)
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_log_barangay_created
  ON public.admin_audit_log(barangay_id, created_at DESC);

CREATE INDEX idx_admin_audit_log_admin_id
  ON public.admin_audit_log(admin_id);

-- 3. Row-Level Security.
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins may read their own barangay's audit log.
CREATE POLICY "admins can read own barangay audit log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (
    public.current_role() = 'admin'
    AND barangay_id = public.current_barangay_id()
  );

-- Admins may insert audit rows for their own barangay.
-- Server actions validate the session before calling; this policy acts as a
-- second-layer guard — a rogue client cannot inject entries for other barangays.
CREATE POLICY "admins can insert own barangay audit log"
  ON public.admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_role() = 'admin'
    AND barangay_id = public.current_barangay_id()
  );

-- Admins may mark rows as read (is_read only) for their own barangay.
CREATE POLICY "admins can update own barangay audit log"
  ON public.admin_audit_log FOR UPDATE
  TO authenticated
  USING (
    public.current_role() = 'admin'
    AND barangay_id = public.current_barangay_id()
  )
  WITH CHECK (
    public.current_role() = 'admin'
    AND barangay_id = public.current_barangay_id()
  );

-- 4. Enable Realtime so the bell dropdown receives live inserts.
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_audit_log;
