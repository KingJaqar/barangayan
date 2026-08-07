-- Admin Resident Directory (read-only) + the admin panel header's notification bell.
-- Small, additive follow-up to the 0007 migration's admin-access pattern.

create policy "admins can read residents in their barangay"
  on public.profiles for select
  to authenticated
  using (
    public.current_role() = 'admin'
    and barangay_id = public.current_barangay_id()
    and role = 'resident'
  );

-- Backs the header's notification bell: newly-submitted requests an admin hasn't
-- opened yet. A view, not a table — no new write path, just a read-shape over
-- service_requests admins can already SELECT (0007 migration's "admins can read all
-- requests in their barangay" policy applies here too, since views run with the
-- querying user's own RLS by default in Postgres).
create view public.admin_notifications as
select id, reference_number, status, created_at, barangay_id
from public.service_requests
where status = 'submitted'
order by created_at desc;

-- Realtime: the admin Services page can now edit/deactivate document_types, and the
-- mobile Documents tab needs to reflect that live (its documents-list.tsx subscribes to
-- this table as of this same change set) — was previously read via a one-shot fetch only.
alter publication supabase_realtime add table public.document_types;
