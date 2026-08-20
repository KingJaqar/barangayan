-- Fixes the Resolved Reports "Mark all as read" button (and the new per-item mark
-- as read / mark as unread icons): 0080_reports_unread_counts.sql added
-- incidents.resolved_read_at, but no RLS policy ever let a resident write it.
--
-- The only existing resident UPDATE policy on incidents ("residents soft-delete own
-- open incident", 0025) is scoped to `status = 'open'`, so a resident's own
-- resolved_read_at update on a *resolved* incident matched zero rows under RLS — no
-- error surfaced (Postgres/PostgREST don't fail an UPDATE that matches 0 rows), it just
-- silently had no effect, which is why the button appeared broken.

create policy "residents mark own resolved incident read"
  on public.incidents for update
  to authenticated
  using (
    reporter_id = auth.uid()
    and status = 'resolved'
    and deleted_at is null
  )
  with check (
    reporter_id = auth.uid()
    -- Only resolved_read_at is expected to change client-side (see markResolvedRead /
    -- markIncidentRead / markIncidentUnread in use-unread-counts.tsx) — RLS here scopes
    -- rows, not columns, same trust boundary as the soft-delete policy above.
  );
