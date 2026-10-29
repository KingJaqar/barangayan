-- Resident Android notifications and announcements, Phase 1: the contracts the Announcements hub
-- (All / Barangay / Account / System) is built on. Additive only; migration 0135 is not edited.
--
--   * Version-1 inbox kinds, destinations, event ids and the existing producers are unchanged.
--     New kinds (account_*, system_*) and version-2 destinations are accepted, but nothing emits
--     them until an operator turns the activation gate on (notification_hub_settings), and a
--     version-2 row gets a phone-alert outbox row only once v2 alerts are enabled as well, which
--     must wait for a sender that understands version 2.
--   * emit_notification_v2 adds the history-only mode (event + inbox, no outbox row) used for a
--     resident's own actions; it never touches preferences.
--   * Resident reads: one summary, keyset inbox pages and one atomic "mark all in this scope" over
--     the full matching dataset. They run as the caller (RLS decides visibility) and change read
--     state only. Announcements stay in their own table; announcement_reads remains canonical and
--     the inbox's announcement row mirrors it in both directions without loops.
--   * System notices are created, published, revised, resolved and cancelled by service_role only.
--     Due notices are published and fanned out in bounded, resumable batches by a function the
--     existing sender calls; no scheduler is added here.

-- ===== Activation gate (operator-controlled; both switches start off) =====
create table if not exists barangayan_private.notification_hub_settings (
  id boolean primary key default true check (id),
  emission_enabled boolean not null default false,
  v2_alerts_enabled boolean not null default false,
  announcement_reads_reconciled_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into barangayan_private.notification_hub_settings(id) values (true) on conflict (id) do nothing;
alter table barangayan_private.notification_hub_settings enable row level security;
revoke all on barangayan_private.notification_hub_settings from public,anon,authenticated,service_role;

-- ===== Kinds, subjects and destinations =====
alter table barangayan_private.notification_events drop constraint if exists notification_events_kind_check;
alter table barangayan_private.notification_events add constraint notification_events_kind_check check (kind in (
  'request_status','payment','incident_status','announcement','medical_drive','health_registration',
  'account_profile','account_verification','account_security','system_service','system_update','system_policy'));
alter table public.notification_inbox drop constraint if exists notification_inbox_kind_check;
alter table public.notification_inbox add constraint notification_inbox_kind_check check (kind in (
  'request_status','payment','incident_status','announcement','medical_drive','health_registration',
  'account_profile','account_verification','account_security','system_service','system_update','system_policy'));
alter table barangayan_private.notification_events drop constraint if exists notification_events_subject_type_check;
alter table barangayan_private.notification_events add constraint notification_events_subject_type_check
  check (subject_type in ('request','incident','announcement','drive','registration','account','notice'));
alter table barangayan_private.notification_events drop constraint if exists notification_events_payload_version_check;
alter table barangayan_private.notification_events add constraint notification_events_payload_version_check check (payload_version in (1,2));

-- Version 1 (unchanged): {"v":1,"kind":request|incident|announcement|drive|registration,"id":<uuid>}.
-- Version 2: {"v":2,"kind":"notice","id":<uuid>} or {"v":2,"kind":"account","screen":<allowlisted screen>}.
-- Never a URL or a route string. Every branch is coalesced: a NULL result would let a CHECK pass.
create or replace function barangayan_private.valid_notification_destination(d jsonb) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(jsonb_typeof(d)='object'
     and (select count(*) from jsonb_object_keys(d))=3
     and case d->>'v'
       when '1' then d->>'kind' in ('request','incident','announcement','drive','registration')
         and (d->>'id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       when '2' then jsonb_typeof(d->'v')='number' and (
            (d->>'kind'='notice' and jsonb_typeof(d->'id')='string'
              and (d->>'id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
         or (d->>'kind'='account' and jsonb_typeof(d->'screen')='string'
              and d->>'screen' in ('settings','profile','valid_id','email_verification','change_password')))
       else false end, false)
$$;

-- The hub chip an inbox kind belongs to; null for kinds outside Account/System (the announcement
-- mirror, Health). Mirrored by apps/resident-android-mobile/src/lib/notification-hub.ts.
create or replace function barangayan_private.notification_kind_filter(p_kind text) returns text
language sql immutable set search_path='' as $$
  select case p_kind
    when 'request_status' then 'document_requests' when 'payment' then 'document_requests'
    when 'incident_status' then 'incident_reports'
    when 'account_verification' then 'verification' when 'account_security' then 'security' when 'account_profile' then 'profile'
    when 'system_service' then 'service_status' when 'system_update' then 'app_updates' when 'system_policy' then 'policies'
  end
$$;

create or replace function barangayan_private.notification_kind_source(p_kind text) returns text
language sql immutable set search_path='' as $$
  select case when barangayan_private.notification_kind_filter(p_kind) in ('service_status','app_updates','policies') then 'system'
              when barangayan_private.notification_kind_filter(p_kind) is not null then 'account' end
$$;

-- A view/chip pair is one of the fixed combinations of plan §2.1; anything else is rejected.
create or replace function barangayan_private.assert_notification_scope(p_view text, p_filter text) returns void
language plpgsql immutable set search_path='' as $$
begin
  if not coalesce(case p_view
      when 'all' then p_filter in ('all','general','emergency','health','events','account','system')
      when 'barangay' then p_filter in ('all','general','emergency','health','events')
      when 'account' then p_filter in ('all','document_requests','incident_reports','verification','security','profile')
      when 'system' then p_filter in ('all','service_status','app_updates','policies')
      else false end, false) then
    raise exception 'invalid_notification_scope' using errcode='22023';
  end if;
end $$;

create or replace function barangayan_private.notification_in_scope(p_kind text, p_view text, p_filter text) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(case
    when barangayan_private.notification_kind_source(p_kind) is null then false
    when p_view='all' then p_filter='all' or p_filter=barangayan_private.notification_kind_source(p_kind)
    when p_view in ('account','system') then p_view=barangayan_private.notification_kind_source(p_kind)
      and (p_filter='all' or p_filter=barangayan_private.notification_kind_filter(p_kind))
    else false end, false)
$$;

create or replace function barangayan_private.announcement_in_scope(p_category text, p_view text, p_filter text) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(p_view in ('all','barangay') and (p_filter='all' or p_filter=p_category), false)
$$;

-- valid_notification_destination keeps its 0135 privileges: the inbox CHECK runs it for every
-- resident read_at update.
revoke all on function barangayan_private.notification_kind_filter(text),barangayan_private.notification_kind_source(text),
  barangayan_private.assert_notification_scope(text,text),barangayan_private.notification_in_scope(text,text,text),
  barangayan_private.announcement_in_scope(text,text,text) from public,anon;
grant execute on function barangayan_private.notification_kind_filter(text),barangayan_private.notification_kind_source(text),
  barangayan_private.assert_notification_scope(text,text),barangayan_private.notification_in_scope(text,text,text),
  barangayan_private.announcement_in_scope(text,text,text) to authenticated;

-- ===== Emission with an explicit alert mode =====
-- Same recipient rule and dedupe as emit_notification. p_alert=false keeps history only. Returns
-- the number of inbox rows written; 0 while the activation gate is off.
create or replace function barangayan_private.emit_notification_v2(
  p_recipients uuid[], p_barangay_id uuid, p_kind text, p_subject_type text, p_subject_id uuid,
  p_dedupe_key text, p_title text, p_body text, p_destination jsonb, p_alert boolean) returns integer
language plpgsql security definer set search_path='' as $$
declare v_on boolean; v_v2_alerts boolean; v_alert boolean; v_count integer;
begin
  select s.emission_enabled,s.v2_alerts_enabled into v_on,v_v2_alerts from barangayan_private.notification_hub_settings s where s.id;
  if not coalesce(v_on,false) then return 0; end if;
  v_alert:=coalesce(p_alert,false) and (p_destination->>'v'='1' or coalesce(v_v2_alerts,false));
  with targets as (
    select p.id from public.profiles p
     where p.id=any(p_recipients) and p.role='resident' and p.deleted_at is null and p.barangay_id=p_barangay_id
  ), ev as (
    insert into barangayan_private.notification_events(barangay_id,recipient_id,kind,subject_type,subject_id,dedupe_key,payload_version)
    select p_barangay_id,t.id,p_kind,p_subject_type,p_subject_id,p_dedupe_key,(p_destination->>'v')::integer from targets t
    on conflict (recipient_id,dedupe_key) do nothing
    returning id,recipient_id
  ), ib as (
    insert into public.notification_inbox(event_id,recipient_id,kind,title,body,destination)
    select e.id,e.recipient_id,p_kind,p_title,p_body,p_destination from ev e
    returning id,recipient_id
  ), ob as (
    insert into barangayan_private.notification_outbox(inbox_id,recipient_id) select i.id,i.recipient_id from ib i where v_alert
  )
  select count(*)::integer into v_count from ib;
  return v_count;
end $$;
revoke all on function barangayan_private.emit_notification_v2(uuid[],uuid,text,text,uuid,text,text,text,jsonb,boolean) from public,anon,authenticated,service_role;

-- ===== Resident reads (caller's rights; RLS decides what is visible) =====
-- One row per source. total/unread cover the whole category (cards, header); scope_total/
-- scope_unread cover the selected view+chip. NULL means "not available to this caller" (a
-- signed-in account without an active profile has no inbox and no read state), never zero.
create or replace function public.notification_hub_summary(p_view text default 'all', p_filter text default 'all')
returns table(source text, total integer, unread integer, scope_total integer, scope_unread integer)
language plpgsql stable set search_path='' as $$
declare v_uid uuid:=(select auth.uid()); v_member uuid;
begin
  perform barangayan_private.assert_notification_scope(p_view,p_filter);
  if v_uid is not null then v_member:=barangayan_private.active_member_barangay_id(); end if;
  if v_member is null then
    return query
      select 'barangay'::text,count(*)::integer,null::integer,
             (count(*) filter (where barangayan_private.announcement_in_scope(a.category,p_view,p_filter)))::integer,null::integer
        from public.announcements a where a.deleted_at is null;
    return query select 'account'::text,null::integer,null::integer,null::integer,null::integer
      union all select 'system'::text,null::integer,null::integer,null::integer,null::integer;
    return;
  end if;
  return query
    with a as (
      select barangayan_private.announcement_in_scope(an.category,p_view,p_filter) as in_scope,
             not exists(select 1 from public.announcement_reads r where r.resident_id=v_uid and r.announcement_id=an.id) as is_unread
        from public.announcements an where an.deleted_at is null and an.barangay_id=v_member
    )
    select 'barangay'::text,count(*)::integer,(count(*) filter (where a.is_unread))::integer,
           (count(*) filter (where a.in_scope))::integer,(count(*) filter (where a.in_scope and a.is_unread))::integer
      from a;
  return query
    with i as (
      select barangayan_private.notification_kind_source(n.kind) as src,
             barangayan_private.notification_in_scope(n.kind,p_view,p_filter) as in_scope,
             n.read_at is null as is_unread
        from public.notification_inbox n where n.recipient_id=v_uid
    ), s(src) as (values ('account'),('system'))
    select s.src,count(i.src)::integer,(count(i.src) filter (where i.is_unread))::integer,
           (count(i.src) filter (where i.in_scope))::integer,(count(i.src) filter (where i.in_scope and i.is_unread))::integer
      from s left join i on i.src=s.src
     group by s.src order by s.src;
end $$;

-- A keyset page of one source ('account' or 'system') within the selected scope, newest first by
-- the inbox's immutable (created_at, id). Pass the last row's pair to get the next page.
create or replace function public.notification_inbox_page(
  p_source text, p_view text default 'all', p_filter text default 'all',
  p_before_created_at timestamptz default null, p_before_id uuid default null, p_limit integer default 25)
returns table(id uuid, kind text, filter text, title text, body text, destination jsonb, created_at timestamptz, read_at timestamptz)
language plpgsql stable set search_path='' as $$
begin
  perform barangayan_private.assert_notification_scope(p_view,p_filter);
  if p_source is null or p_source not in ('account','system') or (p_before_created_at is null)<>(p_before_id is null) then
    raise exception 'invalid_notification_page' using errcode='22023';
  end if;
  return query
    select n.id,n.kind,barangayan_private.notification_kind_filter(n.kind),n.title,n.body,n.destination,n.created_at,n.read_at
      from public.notification_inbox n
     where n.recipient_id=(select auth.uid())
       and barangayan_private.notification_kind_source(n.kind)=p_source
       and barangayan_private.notification_in_scope(n.kind,p_view,p_filter)
       and (p_before_created_at is null or (n.created_at,n.id)<(p_before_created_at,p_before_id))
     order by n.created_at desc,n.id desc
     limit greatest(1,least(coalesce(p_limit,25),50));
end $$;

-- Marks every unread item of the scope read in one statement: the candidate set is that
-- statement's snapshot, so items that arrive later stay unread. Changes read state only and
-- returns what was actually applied. Concurrent calls by the same resident are serialized.
create or replace function public.notification_mark_scope_read(p_view text default 'all', p_filter text default 'all')
returns table(announcements_marked integer, notifications_marked integer)
language plpgsql set search_path='' as $$
declare v_uid uuid:=(select auth.uid()); v_member uuid;
begin
  perform barangayan_private.assert_notification_scope(p_view,p_filter);
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  v_member:=barangayan_private.active_member_barangay_id();
  if v_member is null then raise exception 'forbidden' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('notification_mark_scope_read:'||v_uid::text,0));
  return query
    with ann as (
      select an.id from public.announcements an
       where an.deleted_at is null and an.barangay_id=v_member
         and barangayan_private.announcement_in_scope(an.category,p_view,p_filter)
         and not exists(select 1 from public.announcement_reads r where r.resident_id=v_uid and r.announcement_id=an.id)
    ), ins as (
      insert into public.announcement_reads(resident_id,announcement_id) select v_uid,ann.id from ann
      on conflict (resident_id,announcement_id) do nothing
      returning 1
    ), inb as (
      update public.notification_inbox n set read_at=now()
       where n.recipient_id=v_uid and n.read_at is null and barangayan_private.notification_in_scope(n.kind,p_view,p_filter)
      returning 1
    )
    select (select count(*) from ins)::integer,(select count(*) from inb)::integer;
end $$;

revoke all on function public.notification_hub_summary(text,text),
  public.notification_inbox_page(text,text,text,timestamptz,uuid,integer),
  public.notification_mark_scope_read(text,text) from public,anon,service_role;
-- Guests have no read state or inbox; they keep the public announcement list and get no summary.
grant execute on function public.notification_hub_summary(text,text),
  public.notification_inbox_page(text,text,text,timestamptz,uuid,integer),
  public.notification_mark_scope_read(text,text) to authenticated;

-- ===== Announcement read bridge =====
-- announcement_reads is canonical; the inbox's announcement row (kind 'announcement') mirrors it.
-- Each side writes the other only when the value actually differs, so a change settles after at
-- most one hop. Both run with the caller's rights. Setting barangayan.read_bridge='off' for a
-- transaction pauses the bridge; only the read-restore function below does that.
create index if not exists notification_inbox_announcement_mirror_idx
  on public.notification_inbox(recipient_id,(destination->>'id')) where kind='announcement';

create or replace function barangayan_private.sync_announcement_read_to_inbox() returns trigger
language plpgsql set search_path='' as $$
begin
  if coalesce(current_setting('barangayan.read_bridge',true),'')='off' then return null; end if;
  if tg_op='DELETE' then
    update public.notification_inbox n set read_at=null
     where n.recipient_id=old.resident_id and n.kind='announcement' and n.destination->>'id'=old.announcement_id::text and n.read_at is not null;
  else
    update public.notification_inbox n set read_at=new.read_at
     where n.recipient_id=new.resident_id and n.kind='announcement' and n.destination->>'id'=new.announcement_id::text and n.read_at is null;
  end if;
  return null;
end $$;

create or replace function barangayan_private.sync_inbox_read_to_announcement() returns trigger
language plpgsql set search_path='' as $$
declare v_announcement uuid:=(new.destination->>'id')::uuid;
begin
  if coalesce(current_setting('barangayan.read_bridge',true),'')='off' then return null; end if;
  if new.read_at is null then
    delete from public.announcement_reads r where r.resident_id=new.recipient_id and r.announcement_id=v_announcement;
  elsif old.read_at is null then
    -- Only an announcement the resident can still mark read; anything else leaves the mirror alone.
    insert into public.announcement_reads(resident_id,announcement_id,read_at)
    select new.recipient_id,a.id,new.read_at from public.announcements a
      join public.profiles p on p.id=new.recipient_id and p.deleted_at is null and p.barangay_id=a.barangay_id
     where a.id=v_announcement and a.deleted_at is null
    on conflict (resident_id,announcement_id) do nothing;
  end if;
  return null;
end $$;
revoke all on function barangayan_private.sync_announcement_read_to_inbox(),barangayan_private.sync_inbox_read_to_announcement() from public,anon;

drop trigger if exists z_sync_announcement_read_to_inbox on public.announcement_reads;
create trigger z_sync_announcement_read_to_inbox after insert or delete on public.announcement_reads
  for each row execute function barangayan_private.sync_announcement_read_to_inbox();
drop trigger if exists z_sync_inbox_read_to_announcement on public.notification_inbox;
create trigger z_sync_inbox_read_to_announcement after update of read_at on public.notification_inbox
  for each row when (old.kind='announcement' and old.read_at is distinct from new.read_at)
  execute function barangayan_private.sync_inbox_read_to_announcement();

-- ===== One-time read reconciliation with targeted restore (service_role) =====
-- Before the bridge, the two stores were independent. A read seen in either one is kept: a read
-- mirror adds the missing announcement_reads row; an existing announcement_reads row marks the
-- unread mirror read. Every change is recorded first so a batch can be undone without touching
-- anything a resident changed afterwards.
create table if not exists barangayan_private.notification_read_restore (
  id bigint generated always as identity primary key,
  batch_id uuid not null,
  target text not null check (target in ('announcement_read','inbox')),
  resident_id uuid not null,
  announcement_id uuid not null,
  inbox_id uuid,
  applied_read_at timestamptz not null,
  restored_at timestamptz,
  created_at timestamptz not null default now(),
  check ((target='inbox')=(inbox_id is not null))
);
create index if not exists notification_read_restore_batch_idx on barangayan_private.notification_read_restore(batch_id);
alter table barangayan_private.notification_read_restore enable row level security;
revoke all on barangayan_private.notification_read_restore from public,anon,authenticated,service_role;

create or replace function public.notification_reconcile_announcement_reads(p_limit integer default 100)
returns table(batch_id uuid, reads_added integer, mirrors_marked integer, remaining integer)
language plpgsql security definer set search_path='' as $$
declare v_batch uuid:=gen_random_uuid(); v_limit integer:=greatest(1,least(coalesce(p_limit,100),100)); v_added integer; v_marked integer; v_left integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('notification_reconcile_announcement_reads',0));
  with c as (
    select n.recipient_id,a.id as announcement_id,n.read_at from public.notification_inbox n
      join public.announcements a on a.id::text=n.destination->>'id' and a.deleted_at is null
      join public.profiles p on p.id=n.recipient_id and p.deleted_at is null and p.barangay_id=a.barangay_id
     where n.kind='announcement' and n.read_at is not null
       and not exists(select 1 from public.announcement_reads r where r.resident_id=n.recipient_id and r.announcement_id=a.id)
     order by n.id limit v_limit
  ), rec as (
    insert into barangayan_private.notification_read_restore(batch_id,target,resident_id,announcement_id,applied_read_at)
    select v_batch,'announcement_read',c.recipient_id,c.announcement_id,c.read_at from c
  ), ins as (
    insert into public.announcement_reads(resident_id,announcement_id,read_at) select c.recipient_id,c.announcement_id,c.read_at from c
    on conflict (resident_id,announcement_id) do nothing returning 1
  )
  select count(*)::integer into v_added from ins;

  with c as (
    select n.id,n.recipient_id,r.announcement_id,r.read_at from public.notification_inbox n
      join public.announcement_reads r on r.resident_id=n.recipient_id and r.announcement_id::text=n.destination->>'id'
     where n.kind='announcement' and n.read_at is null
     order by n.id limit v_limit-v_added
  ), rec as (
    insert into barangayan_private.notification_read_restore(batch_id,target,resident_id,announcement_id,inbox_id,applied_read_at)
    select v_batch,'inbox',c.recipient_id,c.announcement_id,c.id,c.read_at from c
  ), upd as (
    update public.notification_inbox n set read_at=c.read_at from c where n.id=c.id and n.read_at is null returning 1
  )
  select count(*)::integer into v_marked from upd;

  select count(*)::integer into v_left from public.notification_inbox n
   where n.kind='announcement' and (
     (n.read_at is null and exists(select 1 from public.announcement_reads r where r.resident_id=n.recipient_id and r.announcement_id::text=n.destination->>'id'))
     or (n.read_at is not null
       and exists(select 1 from public.announcements a join public.profiles p on p.id=n.recipient_id and p.deleted_at is null and p.barangay_id=a.barangay_id
                   where a.id::text=n.destination->>'id' and a.deleted_at is null)
       and not exists(select 1 from public.announcement_reads r where r.resident_id=n.recipient_id and r.announcement_id::text=n.destination->>'id')));
  if v_left=0 then
    update barangayan_private.notification_hub_settings s
       set announcement_reads_reconciled_at=coalesce(s.announcement_reads_reconciled_at,now()),updated_at=now() where s.id;
  end if;
  return query select v_batch,v_added,v_marked,v_left;
end $$;

-- Undoes one batch. A recorded change is reverted only while the value it set is still there; a
-- read the resident changed since is left as they left it and counted as skipped.
create or replace function public.notification_restore_announcement_reads(p_batch_id uuid)
returns table(restored integer, skipped integer)
language plpgsql security definer set search_path='' as $$
declare v_restored integer:=0; v_skipped integer:=0; r record; v_rows integer;
begin
  perform set_config('barangayan.read_bridge','off',true);
  for r in select * from barangayan_private.notification_read_restore x where x.batch_id=p_batch_id and x.restored_at is null order by x.id for update loop
    if r.target='announcement_read' then
      delete from public.announcement_reads a where a.resident_id=r.resident_id and a.announcement_id=r.announcement_id and a.read_at=r.applied_read_at;
    else
      update public.notification_inbox n set read_at=null where n.id=r.inbox_id and n.read_at=r.applied_read_at;
    end if;
    get diagnostics v_rows = row_count;
    if v_rows>0 then
      v_restored:=v_restored+1;
      update barangayan_private.notification_read_restore set restored_at=now() where id=r.id;
    else
      v_skipped:=v_skipped+1;
    end if;
  end loop;
  perform set_config('barangayan.read_bridge','',true);
  return query select v_restored,v_skipped;
end $$;

revoke all on function public.notification_reconcile_announcement_reads(integer),public.notification_restore_announcement_reads(uuid) from public,anon,authenticated;
grant execute on function public.notification_reconcile_announcement_reads(integer),public.notification_restore_announcement_reads(uuid) to service_role;

-- ===== System notices =====
-- Written only by the service_role functions below. Residents read published notices of their
-- barangay (or of every barangay) through RLS and a column-level grant; operator fields stay hidden.
create table if not exists public.system_notices (
  id uuid primary key default gen_random_uuid(),
  subtype text not null check (subtype in ('service_status','app_update','policy')),
  barangay_id uuid references public.barangays(id),
  title text not null check (char_length(title) between 1 and 80 and title=btrim(title)),
  body text not null check (char_length(body) between 1 and 200 and body=btrim(body)),
  state text not null default 'draft' check (state in ('draft','scheduled','published','resolved','cancelled')),
  publish_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  expires_at timestamptz,
  action text check (action in ('services','reports','health','maps','emergency_info','email_verification','terms_privacy')),
  policy_key text check (policy_key in ('privacy_policy','terms_of_service')),
  policy_effective_on date,
  app_version_code integer check (app_version_code between 1 and 2100000000),
  alert boolean not null,
  revision integer not null default 1 check (revision>=1),
  fanout_revision integer not null default 0,
  fanout_cursor uuid,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  resolved_at timestamptz,
  cancelled_at timestamptz,
  check (ends_at is null or starts_at is null or ends_at>starts_at),
  check ((subtype='policy')=(policy_key is not null)),
  check (subtype='policy' or policy_effective_on is null),
  check (subtype='app_update' or app_version_code is null),
  check (state<>'scheduled' or publish_at is not null),
  check ((state in ('published','resolved'))<=(published_at is not null))
);
create index if not exists system_notices_due_idx on public.system_notices(publish_at) where state='scheduled';
create index if not exists system_notices_fanout_idx on public.system_notices(updated_at) where fanout_revision<revision and published_at is not null;
alter table public.system_notices enable row level security;
drop policy if exists "residents read published system notices" on public.system_notices;
create policy "residents read published system notices" on public.system_notices for select to authenticated
  using (published_at is not null and (barangay_id is null or barangay_id=(select barangayan_private.active_member_barangay_id())));
revoke all on public.system_notices from public,anon,authenticated;
grant select (id,subtype,title,body,state,starts_at,ends_at,expires_at,action,policy_key,policy_effective_on,
  app_version_code,revision,published_at,resolved_at,cancelled_at,updated_at) on public.system_notices to authenticated;
grant select on public.system_notices to service_role;

create or replace function barangayan_private.system_notice_text(p_value text, p_max integer) returns text
language plpgsql immutable set search_path='' as $$
begin
  if p_value is null or char_length(btrim(p_value)) not between 1 and p_max then
    raise exception 'invalid_system_notice_text' using errcode='22023';
  end if;
  return btrim(p_value);
end $$;

-- A revision supersedes its predecessors: their phone alerts that have not gone out are skipped.
create or replace function barangayan_private.supersede_system_notice_alerts(p_notice_id uuid) returns void
language sql security definer set search_path='' as $$
  update barangayan_private.notification_outbox o set state='skipped',last_error='superseded',finished_at=now(),updated_at=now()
    from public.notification_inbox i join barangayan_private.notification_events e on e.id=i.event_id
   where o.inbox_id=i.id and o.state='pending' and e.subject_type='notice' and e.subject_id=p_notice_id
$$;
revoke all on function barangayan_private.system_notice_text(text,integer),barangayan_private.supersede_system_notice_alerts(uuid) from public,anon,authenticated,service_role;

create or replace function public.system_notice_create(
  p_subtype text, p_barangay_id uuid, p_title text, p_body text, p_created_by uuid,
  p_starts_at timestamptz default null, p_ends_at timestamptz default null, p_expires_at timestamptz default null,
  p_action text default null, p_policy_key text default null, p_policy_effective_on date default null,
  p_app_version_code integer default null, p_alert boolean default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  -- The operator is an active administrator; a barangay-scoped notice needs one of that barangay.
  if not exists(select 1 from public.profiles p where p.id=p_created_by and p.role='admin' and p.deleted_at is null
                and (p_barangay_id is null or p.barangay_id=p_barangay_id)) then
    raise exception 'system_notice_operator_required' using errcode='42501';
  end if;
  if p_expires_at is not null and p_expires_at<=now() then raise exception 'invalid_system_notice_window' using errcode='22023'; end if;
  if p_action='terms_privacy' and p_subtype<>'policy' then raise exception 'invalid_system_notice_action' using errcode='22023'; end if;
  insert into public.system_notices(subtype,barangay_id,title,body,starts_at,ends_at,expires_at,action,policy_key,policy_effective_on,app_version_code,alert,created_by)
  values (p_subtype,p_barangay_id,barangayan_private.system_notice_text(p_title,80),barangayan_private.system_notice_text(p_body,200),
          p_starts_at,p_ends_at,p_expires_at,case when p_subtype='policy' then coalesce(p_action,'terms_privacy') else p_action end,
          p_policy_key,p_policy_effective_on,p_app_version_code,coalesce(p_alert,p_subtype='service_status'),p_created_by)
  returning id into v_id;
  return v_id;
end $$;

-- Draft → scheduled (future p_publish_at) or published (now). Delivery happens in the due run.
create or replace function public.system_notice_publish(p_notice_id uuid, p_publish_at timestamptz default null) returns text
language plpgsql security definer set search_path='' as $$
declare v_notice public.system_notices; v_at timestamptz:=coalesce(p_publish_at,now());
begin
  select * into v_notice from public.system_notices where id=p_notice_id for update;
  if not found then raise exception 'system_notice_not_found' using errcode='P0002'; end if;
  if v_notice.state<>'draft' then raise exception 'system_notice_state_conflict' using errcode='55000'; end if;
  if v_notice.expires_at is not null and v_notice.expires_at<=v_at then raise exception 'invalid_system_notice_window' using errcode='22023'; end if;
  update public.system_notices set publish_at=v_at,
         state=case when v_at>now() then 'scheduled' else 'published' end,
         published_at=case when v_at>now() then null else now() end,updated_at=now()
   where id=p_notice_id returning state into v_notice.state;
  return v_notice.state;
end $$;

-- Content change of a draft/scheduled/published notice. A material change of a published notice
-- is a new revision and is delivered again; anything else only updates the detail.
create or replace function public.system_notice_revise(
  p_notice_id uuid, p_title text, p_body text, p_material boolean,
  p_starts_at timestamptz default null, p_ends_at timestamptz default null, p_expires_at timestamptz default null) returns integer
language plpgsql security definer set search_path='' as $$
declare v_notice public.system_notices; v_new boolean;
begin
  select * into v_notice from public.system_notices where id=p_notice_id for update;
  if not found then raise exception 'system_notice_not_found' using errcode='P0002'; end if;
  if v_notice.state not in ('draft','scheduled','published') then raise exception 'system_notice_state_conflict' using errcode='55000'; end if;
  if p_expires_at is not null and p_expires_at<=now() then raise exception 'invalid_system_notice_window' using errcode='22023'; end if;
  v_new:=coalesce(p_material,false) and v_notice.state='published';
  update public.system_notices set title=barangayan_private.system_notice_text(p_title,80),body=barangayan_private.system_notice_text(p_body,200),
         starts_at=p_starts_at,ends_at=p_ends_at,expires_at=p_expires_at,
         revision=revision+case when v_new then 1 else 0 end,
         fanout_cursor=case when v_new then null else fanout_cursor end,updated_at=now()
   where id=p_notice_id returning revision into v_notice.revision;
  if v_new then perform barangayan_private.supersede_system_notice_alerts(p_notice_id); end if;
  return v_notice.revision;
end $$;

-- A published service notice is resolved with its recovery message (delivered as a new revision).
create or replace function public.system_notice_resolve(p_notice_id uuid, p_title text, p_body text) returns integer
language plpgsql security definer set search_path='' as $$
declare v_notice public.system_notices;
begin
  select * into v_notice from public.system_notices where id=p_notice_id for update;
  if not found then raise exception 'system_notice_not_found' using errcode='P0002'; end if;
  if v_notice.state<>'published' or v_notice.subtype<>'service_status' then raise exception 'system_notice_state_conflict' using errcode='55000'; end if;
  update public.system_notices set title=barangayan_private.system_notice_text(p_title,80),body=barangayan_private.system_notice_text(p_body,200),
         state='resolved',resolved_at=now(),revision=revision+1,fanout_cursor=null,updated_at=now()
   where id=p_notice_id returning revision into v_notice.revision;
  perform barangayan_private.supersede_system_notice_alerts(p_notice_id);
  return v_notice.revision;
end $$;

-- A draft or scheduled notice is cancelled silently. Cancelling a published notice tells its
-- audience (title/body required) and stops anything older that has not gone out.
create or replace function public.system_notice_cancel(p_notice_id uuid, p_title text default null, p_body text default null) returns integer
language plpgsql security definer set search_path='' as $$
declare v_notice public.system_notices;
begin
  select * into v_notice from public.system_notices where id=p_notice_id for update;
  if not found then raise exception 'system_notice_not_found' using errcode='P0002'; end if;
  if v_notice.state in ('draft','scheduled') then
    update public.system_notices set state='cancelled',cancelled_at=now(),updated_at=now() where id=p_notice_id;
    return v_notice.revision;
  end if;
  if v_notice.state<>'published' then raise exception 'system_notice_state_conflict' using errcode='55000'; end if;
  update public.system_notices set title=barangayan_private.system_notice_text(p_title,80),body=barangayan_private.system_notice_text(p_body,200),
         state='cancelled',cancelled_at=now(),revision=revision+1,fanout_cursor=null,updated_at=now()
   where id=p_notice_id returning revision into v_notice.revision;
  perform barangayan_private.supersede_system_notice_alerts(p_notice_id);
  return v_notice.revision;
end $$;

-- Called by the sender before it claims outbox rows. Publishes due scheduled notices, then
-- delivers pending revisions to at most p_limit (≤100) recipients, resuming from each notice's
-- cursor. Expired notices stop delivering. Does nothing while the activation gate is off.
create or replace function public.notification_publish_due_notices(p_limit integer default 100)
returns table(published integer, delivered integer, pending_notices integer)
language plpgsql security definer set search_path='' as $$
declare v_budget integer:=greatest(1,least(coalesce(p_limit,100),100)); v_published integer:=0; v_delivered integer:=0;
  v_notice public.system_notices; v_batch uuid[]; v_last uuid; v_group record; v_kind text; v_key text;
begin
  if not coalesce((select s.emission_enabled from barangayan_private.notification_hub_settings s where s.id),false) then
    return query select 0,0,(select count(*)::integer from public.system_notices n
      where n.state='scheduled' or (n.published_at is not null and n.fanout_revision<n.revision));
    return;
  end if;
  update public.system_notices set state='published',published_at=now(),updated_at=now()
   where id in (select n.id from public.system_notices n where n.state='scheduled' and n.publish_at<=now()
                 order by n.publish_at limit 100 for update skip locked);
  get diagnostics v_published = row_count;

  for v_notice in
    select * from public.system_notices n where n.published_at is not null and n.fanout_revision<n.revision
     order by n.updated_at for update skip locked
  loop
    exit when v_budget<=0;
    if v_notice.expires_at is not null and v_notice.expires_at<=now() then
      update public.system_notices set fanout_revision=revision,fanout_cursor=null where id=v_notice.id;
      continue;
    end if;
    select array_agg(x.id order by x.id) into v_batch from (
      select p.id from public.profiles p
       where p.role='resident' and p.deleted_at is null and p.barangay_id is not null
         and (v_notice.barangay_id is null or p.barangay_id=v_notice.barangay_id)
         and (v_notice.fanout_cursor is null or p.id>v_notice.fanout_cursor)
       order by p.id limit v_budget) x;
    if v_batch is null then
      update public.system_notices set fanout_revision=revision,fanout_cursor=null where id=v_notice.id;
      continue;
    end if;
    v_kind:=case v_notice.subtype when 'service_status' then 'system_service' when 'app_update' then 'system_update' else 'system_policy' end;
    v_key:='notice:'||v_notice.id||':r'||v_notice.revision;
    for v_group in select p.barangay_id,array_agg(p.id) as ids from public.profiles p where p.id=any(v_batch) group by p.barangay_id loop
      v_delivered:=v_delivered+barangayan_private.emit_notification_v2(v_group.ids,v_group.barangay_id,v_kind,'notice',v_notice.id,v_key,
        v_notice.title,v_notice.body,jsonb_build_object('v',2,'kind','notice','id',v_notice.id),v_notice.alert);
    end loop;
    v_last:=v_batch[array_length(v_batch,1)];
    v_budget:=v_budget-array_length(v_batch,1);
    if v_budget>0 then
      update public.system_notices set fanout_revision=revision,fanout_cursor=null where id=v_notice.id;
    else
      update public.system_notices set fanout_cursor=v_last where id=v_notice.id;
    end if;
  end loop;
  return query select v_published,v_delivered,(select count(*)::integer from public.system_notices n
    where n.state='scheduled' or (n.published_at is not null and n.fanout_revision<n.revision));
end $$;

revoke all on function public.system_notice_create(text,uuid,text,text,uuid,timestamptz,timestamptz,timestamptz,text,text,date,integer,boolean),
  public.system_notice_publish(uuid,timestamptz),public.system_notice_revise(uuid,text,text,boolean,timestamptz,timestamptz,timestamptz),
  public.system_notice_resolve(uuid,text,text),public.system_notice_cancel(uuid,text,text),
  public.notification_publish_due_notices(integer) from public,anon,authenticated;
grant execute on function public.system_notice_create(text,uuid,text,text,uuid,timestamptz,timestamptz,timestamptz,text,text,date,integer,boolean),
  public.system_notice_publish(uuid,timestamptz),public.system_notice_revise(uuid,text,text,boolean,timestamptz,timestamptz,timestamptz),
  public.system_notice_resolve(uuid,text,text),public.system_notice_cancel(uuid,text,text),
  public.notification_publish_due_notices(integer) to service_role;
