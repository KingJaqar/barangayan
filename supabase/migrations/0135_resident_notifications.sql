-- Resident iOS Phase 17 (P17-T01/T02/T03/T07): durable server-backed notification inbox,
-- delivery outbox, per-kind preferences and the worker contract for Expo Push / APNs.
--
-- Design (plan §3 "Required notification architecture", P03-T07 contract):
--   * An event row, its resident inbox row and its outbox row are created by the same
--     statement that observes the source change (AFTER trigger), so none exists without
--     the others. Events are de-duplicated per (recipient, dedupe_key).
--   * The inbox is the resident-visible record. Its text is generic and written here, never
--     copied from a source row (no titles, addresses, names or reporter data), and its
--     destination is a versioned {v,kind,id} reference, never a URL or a snapshot.
--   * Preferences are applied when the worker claims a row (send time), not when the event is
--     created. They control phone alerts only; the inbox always records the event.
--   * Events, outbox and delivery tickets live in barangayan_private (no API exposure). The
--     sender runs as service_role and talks to them only through the notification_worker_*
--     functions below, which no other role can execute.
--   * Inbox read state is independent of announcement_reads and incidents.resolved_read_at.
--   * Client realtime remains a refresh signal; nothing here is a background-delivery promise.

-- ===== Preferences =====
create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  kinds jsonb not null default '{}'::jsonb check (jsonb_typeof(kinds)='object'),
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
drop policy if exists "residents read their notification preferences" on public.notification_preferences;
create policy "residents read their notification preferences" on public.notification_preferences
  for select to authenticated using (user_id=(select auth.uid()));
revoke all on public.notification_preferences from public,anon,authenticated;
grant select on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;

-- ===== Events (private) =====
create table if not exists barangayan_private.notification_events (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays(id),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('request_status','payment','incident_status','announcement','medical_drive','health_registration')),
  subject_type text not null check (subject_type in ('request','incident','announcement','drive','registration')),
  subject_id uuid not null,
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 200),
  payload_version integer not null default 1 check (payload_version=1),
  created_at timestamptz not null default now(),
  unique (recipient_id, dedupe_key)
);
create index if not exists notification_events_created_idx on barangayan_private.notification_events(created_at);

-- A destination is exactly {"v":1,"kind":<allowlisted>,"id":<uuid>}.
create or replace function barangayan_private.valid_notification_destination(d jsonb) returns boolean
language sql immutable set search_path='' as $$
  select jsonb_typeof(d)='object'
     and (select count(*) from jsonb_object_keys(d))=3
     and d->>'v'='1'
     and d->>'kind' in ('request','incident','announcement','drive','registration')
     and (d->>'id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
$$;

-- ===== Inbox (resident-visible) =====
create table if not exists public.notification_inbox (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references barangayan_private.notification_events(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('request_status','payment','incident_status','announcement','medical_drive','health_registration')),
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 200),
  destination jsonb not null check (barangayan_private.valid_notification_destination(destination)),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notification_inbox_owner_idx on public.notification_inbox(recipient_id, created_at desc, id desc);
create index if not exists notification_inbox_unread_idx on public.notification_inbox(recipient_id) where read_at is null;
alter table public.notification_inbox enable row level security;
drop policy if exists "residents read their inbox" on public.notification_inbox;
drop policy if exists "residents mark their inbox read" on public.notification_inbox;
create policy "residents read their inbox" on public.notification_inbox for select to authenticated
  using (recipient_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=recipient_id and p.deleted_at is null));
create policy "residents mark their inbox read" on public.notification_inbox for update to authenticated
  using (recipient_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=recipient_id and p.deleted_at is null))
  with check (recipient_id=(select auth.uid()));
-- Residents may change read_at and nothing else: the privilege is column-level.
revoke all on public.notification_inbox from public,anon,authenticated;
grant select on public.notification_inbox to authenticated;
grant update (read_at) on public.notification_inbox to authenticated;
grant all on public.notification_inbox to service_role;

-- ===== Outbox and delivery tickets (private) =====
create table if not exists barangayan_private.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  inbox_id uuid not null unique references public.notification_inbox(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  state text not null default 'pending' check (state in ('pending','sending','sent','skipped','dead')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  last_error text check (char_length(last_error)<=200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists notification_outbox_due_idx on barangayan_private.notification_outbox(next_attempt_at) where state in ('pending','sending');
create index if not exists notification_outbox_finished_idx on barangayan_private.notification_outbox(finished_at) where finished_at is not null;

create table if not exists barangayan_private.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null references barangayan_private.notification_outbox(id) on delete cascade,
  expo_push_token text not null,
  ticket_id text,
  -- accepted: Expo took the message (ticket ok). provider_ok: Expo's receipt says APNs took it.
  -- Neither means the phone showed it. expired: no receipt within the retention window.
  state text not null default 'accepted' check (state in ('accepted','provider_ok','error','expired')),
  error_code text check (char_length(error_code)<=60),
  sent_at timestamptz not null default now(),
  receipt_checked_at timestamptz
);
create index if not exists notification_deliveries_receipt_idx on barangayan_private.notification_deliveries(sent_at) where state='accepted';

revoke all on all tables in schema barangayan_private from public,anon,authenticated;
grant all on barangayan_private.notification_events, barangayan_private.notification_outbox, barangayan_private.notification_deliveries to service_role;

-- ===== Event creation =====
-- One statement writes the event, the inbox row and the outbox row for every eligible
-- recipient. A recipient is a non-deleted resident of the given barangay; anyone else is
-- dropped. Re-emitting the same dedupe key for the same recipient writes nothing.
create or replace function barangayan_private.emit_notification(
  p_recipients uuid[], p_barangay_id uuid, p_kind text, p_subject_type text, p_subject_id uuid,
  p_dedupe_key text, p_title text, p_body text) returns integer
language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  with targets as (
    select p.id from public.profiles p
     where p.id=any(p_recipients) and p.role='resident' and p.deleted_at is null and p.barangay_id=p_barangay_id
  ), ev as (
    insert into barangayan_private.notification_events(barangay_id,recipient_id,kind,subject_type,subject_id,dedupe_key)
    select p_barangay_id,t.id,p_kind,p_subject_type,p_subject_id,p_dedupe_key from targets t
    on conflict (recipient_id,dedupe_key) do nothing
    returning id,recipient_id
  ), ib as (
    insert into public.notification_inbox(event_id,recipient_id,kind,title,body,destination)
    select e.id,e.recipient_id,p_kind,p_title,p_body,jsonb_build_object('v',1,'kind',p_subject_type,'id',p_subject_id) from ev e
    returning id,recipient_id
  )
  insert into barangayan_private.notification_outbox(inbox_id,recipient_id) select i.id,i.recipient_id from ib i;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- A failed notification must never roll back the operational change that caused it.
create or replace function barangayan_private.notify_request_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_title text; v_body text; v_kind text; v_key text;
begin
  if new.deleted_at is not null or v_actor is not distinct from new.resident_id then return null; end if;
  if new.payment_status is distinct from old.payment_status and new.payment_status in ('paid','waived') then
    v_kind:='payment'; v_title:='Payment update';
    v_body:=case new.payment_status when 'paid' then 'Your payment was received.' else 'No payment is due for your request.' end;
    v_key:='request:'||new.id||':payment:'||new.payment_status;
    perform barangayan_private.emit_notification(array[new.resident_id],new.barangay_id,v_kind,'request',new.id,v_key,v_title,v_body);
  end if;
  if new.status is distinct from old.status and new.status in ('in_progress','ready_for_pickup','completed','cancelled') then
    v_kind:='request_status';
    v_title:=case new.status when 'ready_for_pickup' then 'Request ready' else 'Request update' end;
    v_body:=case new.status
      when 'in_progress' then 'Your document request is being processed.'
      when 'ready_for_pickup' then 'Your document is ready for pickup.'
      when 'completed' then 'Your document request is complete.'
      else 'Your document request was cancelled.' end;
    v_key:='request:'||new.id||':status:'||new.status;
    perform barangayan_private.emit_notification(array[new.resident_id],new.barangay_id,v_kind,'request',new.id,v_key,v_title,v_body);
  end if;
  return null;
exception when others then
  raise warning 'notify_request_change failed: %',sqlstate;
  return null;
end $$;

create or replace function barangayan_private.notify_incident_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.deleted_at is not null or new.reporter_id is null or new.reporter_id is not distinct from (select auth.uid())
     or new.status not in ('in_progress','resolved','unresolved') then return null; end if;
  perform barangayan_private.emit_notification(array[new.reporter_id],new.barangay_id,'incident_status','incident',new.id,
    'incident:'||new.id||':status:'||new.status,'Report update','Your report has a new status.');
  return null;
exception when others then
  raise warning 'notify_incident_change failed: %',sqlstate;
  return null;
end $$;

create or replace function barangayan_private.notify_announcement() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.deleted_at is not null or new.published_at>now() then return null; end if;
  perform barangayan_private.emit_notification(
    (select coalesce(array_agg(p.id),'{}') from public.profiles p where p.barangay_id=new.barangay_id and p.role='resident' and p.deleted_at is null),
    new.barangay_id,'announcement','announcement',new.id,'announcement:'||new.id,'New announcement','Your barangay posted a new announcement.');
  return null;
exception when others then
  raise warning 'notify_announcement failed: %',sqlstate;
  return null;
end $$;

create or replace function barangayan_private.notify_medical_drive() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.deleted_at is not null or not new.is_active then return null; end if;
  perform barangayan_private.emit_notification(
    (select coalesce(array_agg(p.id),'{}') from public.profiles p where p.barangay_id=new.barangay_id and p.role='resident' and p.deleted_at is null),
    new.barangay_id,'medical_drive','drive',new.id,'drive:'||new.id,'New medical drive','A new medical drive is open in your barangay.');
  return null;
exception when others then
  raise warning 'notify_medical_drive failed: %',sqlstate;
  return null;
end $$;

create or replace function barangayan_private.notify_drive_registration() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_barangay uuid;
begin
  if new.status not in ('confirmed','attended','cancelled') or new.user_id is not distinct from (select auth.uid()) then return null; end if;
  select d.barangay_id into v_barangay from public.medical_drives d where d.id=new.drive_id;
  if v_barangay is null then return null; end if;
  perform barangayan_private.emit_notification(array[new.user_id],v_barangay,'health_registration','registration',new.id,
    'registration:'||new.id||':status:'||new.status,'Registration update','Your medical drive registration has a new status.');
  return null;
exception when others then
  raise warning 'notify_drive_registration failed: %',sqlstate;
  return null;
end $$;

drop trigger if exists z_notify_request_change on public.service_requests;
create trigger z_notify_request_change after update of status,payment_status on public.service_requests
  for each row when (old.status is distinct from new.status or old.payment_status is distinct from new.payment_status)
  execute function barangayan_private.notify_request_change();
drop trigger if exists z_notify_incident_change on public.incidents;
create trigger z_notify_incident_change after update of status on public.incidents
  for each row when (old.status is distinct from new.status)
  execute function barangayan_private.notify_incident_change();
drop trigger if exists z_notify_announcement on public.announcements;
create trigger z_notify_announcement after insert on public.announcements
  for each row execute function barangayan_private.notify_announcement();
drop trigger if exists z_notify_medical_drive on public.medical_drives;
create trigger z_notify_medical_drive after insert on public.medical_drives
  for each row execute function barangayan_private.notify_medical_drive();
drop trigger if exists z_notify_drive_registration on public.drive_registrations;
create trigger z_notify_drive_registration after update of status on public.drive_registrations
  for each row when (old.status is distinct from new.status)
  execute function barangayan_private.notify_drive_registration();

revoke all on function barangayan_private.emit_notification(uuid[],uuid,text,text,uuid,text,text,text) from public,anon,authenticated;
revoke all on function barangayan_private.notify_request_change(),barangayan_private.notify_incident_change(),barangayan_private.notify_announcement(),
  barangayan_private.notify_medical_drive(),barangayan_private.notify_drive_registration() from public,anon,authenticated;

-- ===== Resident operations =====
-- Preferences: the global switch stays on profiles.push_notifications_enabled (migration 0063);
-- per-kind switches are merged into notification_preferences.kinds. Both only ever change the
-- caller's own rows.
create or replace function public.set_notification_preferences(p_push_enabled boolean default null, p_kinds jsonb default null)
returns table(push_enabled boolean, kinds jsonb)
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare v_uid uuid:=(select auth.uid()); v_key text; v_val jsonb;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_uid and p.role='resident' and p.deleted_at is null) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_kinds is not null then
    if jsonb_typeof(p_kinds)<>'object' or (select count(*) from jsonb_object_keys(p_kinds))>10 then
      raise exception 'invalid_notification_preferences' using errcode='22023';
    end if;
    for v_key,v_val in select * from jsonb_each(p_kinds) loop
      if v_key not in ('request_status','payment','incident_status','announcement','medical_drive','health_registration')
         or jsonb_typeof(v_val)<>'boolean' then
        raise exception 'invalid_notification_preferences' using errcode='22023';
      end if;
    end loop;
    insert into public.notification_preferences as np(user_id,kinds) values (v_uid,p_kinds)
    on conflict (user_id) do update set kinds=np.kinds||excluded.kinds, updated_at=now();
  end if;
  if p_push_enabled is not null then
    update public.profiles set push_notifications_enabled=p_push_enabled where id=v_uid;
  end if;
  return query select p.push_notifications_enabled,coalesce((select np.kinds from public.notification_preferences np where np.user_id=v_uid),'{}'::jsonb)
    from public.profiles p where p.id=v_uid;
end $$;

-- Offline-logout recovery. A device that signed out without reaching the server has no session to
-- remove its token with, so this is callable without one: possession of the token is the proof, and
-- a push token is delivered only to the app on the device that owns it and to this server. It can
-- only ever remove a delivery address (never read or change anything else), it answers the same
-- whether or not the token existed (no oracle), and a token's format is checked so it cannot be
-- used to probe. The app re-registers its token on the next eligible session, so a wrongly removed
-- token costs at most alerts until the device is next opened.
create or replace function public.release_push_token(p_expo_push_token text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_expo_push_token is null or char_length(p_expo_push_token)>200
     or p_expo_push_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$' then
    raise exception 'invalid_push_token' using errcode='22023';
  end if;
  delete from public.push_tokens where expo_push_token=p_expo_push_token;
end $$;

revoke all on function public.set_notification_preferences(boolean,jsonb) from public,anon;
revoke all on function public.release_push_token(text) from public;
grant execute on function public.set_notification_preferences(boolean,jsonb) to authenticated,service_role;
grant execute on function public.release_push_token(text) to anon,authenticated,service_role;

-- ===== Sender (service_role only) =====
-- The sender claims due rows, applies the resident's preferences at that moment, sends to the
-- resident's current tokens through Expo Push, and reports tickets, failures and receipts back.

create or replace function barangayan_private.notification_retry(p_outbox_id uuid, p_error text) returns text
language plpgsql security definer set search_path='' as $$
declare v_attempts integer; v_state text;
begin
  select attempt_count into v_attempts from barangayan_private.notification_outbox where id=p_outbox_id;
  if not found then return null; end if;
  if v_attempts>=5 then
    update barangayan_private.notification_outbox set state='dead',last_error=left(p_error,200),finished_at=now(),updated_at=now() where id=p_outbox_id;
    return 'dead';
  end if;
  update barangayan_private.notification_outbox
     set state='pending',last_error=left(p_error,200),claimed_at=null,updated_at=now(),
         next_attempt_at=now()+make_interval(secs=>(array[60,300,900,3600])[least(greatest(v_attempts,1),4)])
   where id=p_outbox_id;
  return 'pending';
end $$;

create or replace function public.notification_worker_claim(p_limit integer default 50)
returns table(outbox_id uuid, inbox_id uuid, kind text, title text, body text, destination jsonb, tokens text[], attempt integer)
language plpgsql security definer set search_path='' as $$
declare r record; v_tokens text[]; v_reason text;
begin
  for r in
    select o.id as oid,o.inbox_id as iid,o.recipient_id as rid,o.attempt_count as tries,o.created_at as made,i.kind as ikind,i.title as ititle,i.body as ibody,i.destination as idest
      from barangayan_private.notification_outbox o join public.notification_inbox i on i.id=o.inbox_id
     where (o.state='pending' and o.next_attempt_at<=now()) or (o.state='sending' and o.claimed_at<now()-interval '5 minutes')
     order by o.next_attempt_at
     limit greatest(1,least(coalesce(p_limit,50),100))
     for update of o skip locked
  loop
    v_reason:=null; v_tokens:=null;
    if r.tries>=5 then
      update barangayan_private.notification_outbox set state='dead',last_error='abandoned',finished_at=now(),updated_at=now() where id=r.oid;
      continue;
    end if;
    if r.made<now()-interval '24 hours' then v_reason:='stale';
    elsif not exists(select 1 from public.profiles p where p.id=r.rid and p.role='resident' and p.deleted_at is null and p.push_notifications_enabled) then v_reason:='opted_out';
    elsif exists(select 1 from public.notification_preferences np where np.user_id=r.rid and np.kinds->>r.ikind='false') then v_reason:='kind_off';
    else
      select array_agg(x.t) into v_tokens from (
        select t.expo_push_token as t from public.push_tokens t
         where t.user_id=r.rid and t.last_used_at>now()-interval '60 days'
         order by t.last_used_at desc limit 10) x;
      if v_tokens is null then v_reason:='no_token'; end if;
    end if;
    if v_reason is not null then
      update barangayan_private.notification_outbox set state='skipped',last_error=v_reason,finished_at=now(),updated_at=now() where id=r.oid;
      continue;
    end if;
    update barangayan_private.notification_outbox set state='sending',claimed_at=now(),attempt_count=attempt_count+1,updated_at=now() where id=r.oid;
    outbox_id:=r.oid; inbox_id:=r.iid; kind:=r.ikind; title:=r.ititle; body:=r.ibody; destination:=r.idest; tokens:=v_tokens; attempt:=r.tries+1;
    return next;
  end loop;
end $$;

-- p_tickets: [{"token":"...","status":"ok","id":"..."} | {"token":"...","status":"error","error":"DeviceNotRegistered"}]
create or replace function public.notification_worker_record_tickets(p_outbox_id uuid, p_tickets jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare t jsonb; v_ok integer:=0; v_gone integer:=0; v_total integer:=0; v_error text;
begin
  if jsonb_typeof(p_tickets)<>'array' or jsonb_array_length(p_tickets)>20 then raise exception 'invalid_tickets' using errcode='22023'; end if;
  perform 1 from barangayan_private.notification_outbox where id=p_outbox_id and state='sending' for update;
  if not found then raise exception 'outbox_not_claimed' using errcode='P0002'; end if;
  for t in select * from jsonb_array_elements(p_tickets) loop
    if jsonb_typeof(t)<>'object' or jsonb_typeof(t->'token')<>'string' or t->>'status' not in ('ok','error') then
      raise exception 'invalid_tickets' using errcode='22023';
    end if;
    v_total:=v_total+1;
    if t->>'status'='ok' then
      v_ok:=v_ok+1;
      insert into barangayan_private.notification_deliveries(outbox_id,expo_push_token,ticket_id,state) values (p_outbox_id,t->>'token',left(t->>'id',100),'accepted');
    else
      v_error:=left(coalesce(t->>'error','unknown'),60);
      insert into barangayan_private.notification_deliveries(outbox_id,expo_push_token,state,error_code) values (p_outbox_id,t->>'token','error',v_error);
      if v_error='DeviceNotRegistered' then
        v_gone:=v_gone+1;
        delete from public.push_tokens where expo_push_token=t->>'token';
      end if;
    end if;
  end loop;
  if v_ok>0 then
    update barangayan_private.notification_outbox set state='sent',last_error=null,finished_at=now(),updated_at=now() where id=p_outbox_id;
    return 'sent';
  elsif v_total>0 and v_gone=v_total then
    update barangayan_private.notification_outbox set state='skipped',last_error='device_not_registered',finished_at=now(),updated_at=now() where id=p_outbox_id;
    return 'skipped';
  end if;
  return barangayan_private.notification_retry(p_outbox_id,'ticket_error:'||coalesce(v_error,'none'));
end $$;

create or replace function public.notification_worker_fail(p_outbox_id uuid, p_error text) returns text
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from barangayan_private.notification_outbox where id=p_outbox_id and state='sending' for update;
  if not found then raise exception 'outbox_not_claimed' using errcode='P0002'; end if;
  return barangayan_private.notification_retry(p_outbox_id,regexp_replace(coalesce(p_error,'unknown'),'Expo(nent)?PushToken\[[^]]*\]','[token]','g'));
end $$;

-- Tickets whose receipt is due (at least 15 minutes old, inside Expo's 24 hour retention).
create or replace function public.notification_worker_due_receipts(p_limit integer default 300)
returns table(delivery_id uuid, ticket_id text)
language plpgsql security definer set search_path='' as $$
begin
  update barangayan_private.notification_deliveries set state='expired',receipt_checked_at=now()
   where state='accepted' and sent_at<=now()-interval '23 hours';
  return query select d.id,d.ticket_id from barangayan_private.notification_deliveries d
   where d.state='accepted' and d.ticket_id is not null and d.sent_at<=now()-interval '15 minutes'
   order by d.sent_at limit greatest(1,least(coalesce(p_limit,300),1000));
end $$;

-- p_receipts: [{"delivery_id":"<uuid>","status":"ok"} | {"delivery_id":"<uuid>","status":"error","error":"DeviceNotRegistered"}]
create or replace function public.notification_worker_record_receipts(p_receipts jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare r jsonb; v_count integer:=0; v_error text; v_token text; v_updated integer;
begin
  if jsonb_typeof(p_receipts)<>'array' or jsonb_array_length(p_receipts)>1000 then raise exception 'invalid_receipts' using errcode='22023'; end if;
  for r in select * from jsonb_array_elements(p_receipts) loop
    if jsonb_typeof(r)<>'object' or r->>'status' not in ('ok','error')
       or (r->>'delivery_id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'invalid_receipts' using errcode='22023';
    end if;
    if r->>'status'='ok' then
      update barangayan_private.notification_deliveries set state='provider_ok',receipt_checked_at=now()
       where id=(r->>'delivery_id')::uuid and state='accepted';
    else
      v_error:=left(coalesce(r->>'error','unknown'),60);
      update barangayan_private.notification_deliveries set state='error',error_code=v_error,receipt_checked_at=now()
       where id=(r->>'delivery_id')::uuid and state='accepted' returning expo_push_token into v_token;
      if v_error='DeviceNotRegistered' and v_token is not null then
        delete from public.push_tokens where expo_push_token=v_token;
      end if;
    end if;
    get diagnostics v_updated = row_count;
    v_count:=v_count+v_updated;
  end loop;
  return v_count;
end $$;

-- Operational counts the sender returns on every run so a monitor can alert on them.
create or replace function public.notification_worker_health()
returns table(pending_total integer, oldest_pending_seconds integer, dead_last_24h integer, ticket_errors_last_24h integer, unreceipted_over_1h integer)
language sql security definer set search_path='' as $$
  select (select count(*)::int from barangayan_private.notification_outbox where state in ('pending','sending')),
         (select coalesce(extract(epoch from now()-min(next_attempt_at))::int,0) from barangayan_private.notification_outbox where state in ('pending','sending') and next_attempt_at<=now()),
         (select count(*)::int from barangayan_private.notification_outbox where state='dead' and finished_at>now()-interval '24 hours'),
         (select count(*)::int from barangayan_private.notification_deliveries where state='error' and sent_at>now()-interval '24 hours'),
         (select count(*)::int from barangayan_private.notification_deliveries where state='accepted' and sent_at<now()-interval '1 hour')
$$;

-- Retention (P03-T07): read inbox rows 90 days after reading, finished outbox rows 30 days, events 180 days.
create or replace function public.notification_worker_purge() returns table(inbox_deleted integer, outbox_deleted integer, events_deleted integer)
language plpgsql security definer set search_path='' as $$
declare a integer; b integer; c integer;
begin
  delete from barangayan_private.notification_outbox where finished_at<now()-interval '30 days';
  get diagnostics b = row_count;
  delete from public.notification_inbox where read_at<now()-interval '90 days';
  get diagnostics a = row_count;
  delete from barangayan_private.notification_events e where e.created_at<now()-interval '180 days'
    and not exists(select 1 from public.notification_inbox i where i.event_id=e.id);
  get diagnostics c = row_count;
  return query select a,b,c;
end $$;

revoke all on function barangayan_private.notification_retry(uuid,text) from public,anon,authenticated;
revoke all on function public.notification_worker_claim(integer),public.notification_worker_record_tickets(uuid,jsonb),
  public.notification_worker_fail(uuid,text),public.notification_worker_due_receipts(integer),
  public.notification_worker_record_receipts(jsonb),public.notification_worker_health(),public.notification_worker_purge() from public,anon,authenticated;
grant execute on function public.notification_worker_claim(integer),public.notification_worker_record_tickets(uuid,jsonb),
  public.notification_worker_fail(uuid,text),public.notification_worker_due_receipts(integer),
  public.notification_worker_record_receipts(jsonb),public.notification_worker_health(),public.notification_worker_purge() to service_role;

-- ===== Realtime: refresh signal for the resident's own inbox rows =====
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notification_inbox') then
    alter publication supabase_realtime add table public.notification_inbox;
  end if;
end $$;
