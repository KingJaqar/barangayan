-- Ticket 15: pg_cron-driven trash/dumping scoring + zone_id link.
--
-- Two gaps named in the audit report:
--   1. Incidents never linked to a waste_zones row — reports couldn't be
--      grouped by zone at all despite the module being named "zone-based."
--   2. trashIncidentScore() only ever ran on-demand at page render
--      (apps/admin-web/.../waste-management/page.tsx), never via the specced
--      pg_cron scheduled job.
--
-- This keeps the existing on-demand per-incident score (still useful for a
-- live "which reports need review" list) and adds a *separate*,
-- cron-computed per-zone aggregate score — the operational "which zone needs
-- attention" signal the spec actually asks pg_cron to produce.

alter table public.incidents
  add column if not exists zone_id uuid references public.waste_zones(id) on delete set null;

create index if not exists incidents_zone_id_idx on public.incidents (zone_id) where zone_id is not null;

alter table public.waste_zones
  add column if not exists trash_score            numeric     not null default 0,
  add column if not exists trash_score_updated_at  timestamptz;

comment on column public.waste_zones.trash_score is
  'Cron-computed Time-Decay Weighted Frequency Score (AGENTS.md §3, Module 9) — '
  'sum of confirmation_count * exp(-ln(2)/halfLifeDays * ageDays) across every '
  'non-deleted trash-related incident linked to this zone. Recomputed hourly by '
  'recompute_waste_zone_scores() via pg_cron, not on page render.';

create or replace function public.recompute_waste_zone_scores()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Keep in sync with DEFAULT_TRASH_SCORING_CONFIG.halfLifeDays
  -- (packages/shared/src/constants/priority-weights.ts) — same formula as the
  -- client-side trashIncidentScore() helper (packages/shared/src/lib/format.ts),
  -- just evaluated in SQL against a whole zone instead of one incident in JS.
  v_half_life_days numeric := 14;
begin
  update public.waste_zones z
  set trash_score = coalesce(scores.total_score, 0),
      trash_score_updated_at = now()
  from (
    select
      i.zone_id,
      sum(
        i.confirmation_count *
        exp(-ln(2) / v_half_life_days * (extract(epoch from (now() - i.created_at)) / 86400.0))
      ) as total_score
    from public.incidents i
    join public.incident_categories c on c.id = i.category_id
    where c.is_trash_related = true
      and i.deleted_at is null
      and i.zone_id is not null
      and i.confirmation_count > 0
    group by i.zone_id
  ) scores
  where z.id = scores.zone_id;

  -- Zones with no currently-scoring incidents reset to 0 instead of keeping a
  -- stale score from reports that have since aged out (0 confirmations) or
  -- been resolved/deleted.
  update public.waste_zones z
  set trash_score = 0, trash_score_updated_at = now()
  where z.trash_score != 0
    and not exists (
      select 1
      from public.incidents i
      join public.incident_categories c on c.id = i.category_id
      where i.zone_id = z.id
        and c.is_trash_related = true
        and i.deleted_at is null
        and i.confirmation_count > 0
    );
end;
$$;

comment on function public.recompute_waste_zone_scores() is
  'Scheduled hourly via pg_cron (see the cron.schedule call below, when the '
  'pg_cron extension is available). Recomputes waste_zones.trash_score for '
  'every zone from its linked trash-related incidents.';

-- pg_cron is a hosted-Postgres extension: available on Supabase-hosted projects,
-- not always present in a local/self-hosted dev Postgres. Both blocks below are
-- guarded so this migration succeeds either way — the score simply won't
-- auto-refresh on an environment without pg_cron (it can still be called
-- manually: `select recompute_waste_zone_scores();`).
do $$
begin
  create extension if not exists pg_cron with schema extensions;
exception when others then
  raise notice 'pg_cron extension unavailable in this environment — skipping scheduled job (recompute_waste_zone_scores() can still be called manually).';
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'recompute-waste-zone-scores';
    perform cron.schedule(
      'recompute-waste-zone-scores',
      '0 * * * *', -- hourly, on the hour
      $job$select public.recompute_waste_zone_scores();$job$
    );
  end if;
end $$;

-- Seed an initial score immediately rather than waiting up to an hour for the
-- first cron tick.
select public.recompute_waste_zone_scores();
