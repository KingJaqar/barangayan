-- Approved Phase 1 lifetime contract. Add before the compatible publisher/Android consumer.
-- No backfill: legacy emergency posts keep an unknown lifetime and are ordinary feed items.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.announcements
  add column alert_expires_at timestamptz,
  add constraint announcements_alert_lifetime_check check (
    alert_expires_at is null or (
      category = 'emergency'
      and isfinite(published_at)
      and isfinite(alert_expires_at)
      and alert_expires_at > published_at
    )
  );

comment on column public.announcements.alert_expires_at is
  'Explicit advisory expiry. Null is unknown/inactive; finite emergency expiry must follow publication. Keep on application rollback; never infer or backfill legacy lifetimes.';
