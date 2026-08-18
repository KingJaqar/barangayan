-- Rate-limit the "Download My Data" export (settings screen, export-my-data
-- edge function). Nothing stopped a session from calling it repeatedly —
-- low severity since every query it runs is already RLS-scoped to the
-- caller's own rows, but it still fans out into 6 parallel queries per call,
-- so a stray retry loop or automated hammering is needless load for no
-- benefit to the resident.
--
-- This is a soft, client-writable throttle (not a hard security boundary —
-- a resident who resets their own timestamp only lets themselves export
-- their own data sooner, which isn't a privacy or integrity issue), so a
-- plain column updatable under the existing "residents can update their own
-- profile" policy (migration 0001) is sufficient; no new RPC needed.

alter table public.profiles
  add column if not exists last_data_export_at timestamptz;

comment on column public.profiles.last_data_export_at is
  'Set by the export-my-data edge function each time this resident successfully '
  'downloads their data. Used to enforce a client-side cooldown between exports. '
  'NULL = never exported.';
