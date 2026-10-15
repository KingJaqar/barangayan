begin;

-- The row controls need the catalog fee when a legacy snapshot is absent, so
-- free requests never offer a collection action that cannot succeed.
do $$
declare projection text; definition text;
begin
  foreach projection in array array['admin_requests_browse','admin_requests_records'] loop
    if to_regclass('public.'||projection) is not null then
      definition := pg_get_viewdef(('public.'||projection)::regclass,true);
      definition := regexp_replace(definition,'jsonb_build_object\(''name''(::text)?, d\.name\)',
        'jsonb_build_object(''name'', d.name, ''fee_centavos'', d.fee_centavos)','g');
      execute format('create or replace view public.%I with (security_invoker=true) as %s',projection,definition);
    end if;
  end loop;
end $$;

-- Keep the existing RPC signatures, but enforce the same active-account,
-- tenant, archive and transition guards as the versioned request workflow.
create function barangayan_private.admin_request_transition(p_request_id uuid, p_action text, p_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare
  actor public.profiles;
  request public.service_requests;
  next_status text;
  previous_note text;
  previous_completion text;
begin
  actor := barangayan_private.assert_actor(true);
  select * into request from public.service_requests
  where id=p_request_id and barangay_id=actor.barangay_id and deleted_at is null for update;
  if not found then raise exception 'This request is unavailable or outside your barangay.' using errcode='42501'; end if;
  if p_action is null or p_action not in ('accept','ready','release','cancel') then
    raise exception 'Select a valid request action.' using errcode='22023';
  end if;
  if p_action='cancel' and (length(btrim(coalesce(p_note,''))) not between 1 and 1000) then
    raise exception 'Enter a cancellation reason between 1 and 1000 characters.' using errcode='22023';
  end if;
  if request.contract_version=2 then
    perform barangayan_private.transition_service_request_sla(jsonb_strip_nulls(jsonb_build_object(
      'requestId',request.id,'action',p_action,'reason',case when p_action='cancel' then btrim(p_note) end,
      'requirementsComplete',true,'personalAppearanceReady',true)));
    return;
  end if;
  next_status := case p_action when 'accept' then 'in_progress' when 'ready' then 'ready_for_pickup'
    when 'release' then 'completed' when 'cancel' then 'cancelled' end;
  if request.status=next_status then return; end if;
  if not ((p_action='accept' and request.status='submitted')
    or (p_action='ready' and request.status='in_progress')
    or (p_action='release' and request.status='ready_for_pickup')
    or (p_action='cancel' and request.status in ('submitted','in_progress','ready_for_pickup'))) then
    raise exception 'This action is no longer available for the request status.' using errcode='22023';
  end if;
  previous_note := current_setting('barangayan.status_note',true);
  previous_completion := current_setting('barangayan.allow_request_completion',true);
  perform set_config('barangayan.status_note',case when p_action='cancel' then btrim(p_note)
    when p_action='accept' then 'Moved to processing' when p_action='ready' then 'Marked as ready for pickup'
    else 'Marked as completed' end,true);
  if p_action='release' then perform set_config('barangayan.allow_request_completion','true',true); end if;
  update public.service_requests set status=next_status where id=request.id;
  perform set_config('barangayan.status_note',coalesce(previous_note,''),true);
  perform set_config('barangayan.allow_request_completion',coalesce(previous_completion,''),true);
end $$;

create or replace function public.begin_processing_request(request_id uuid)
returns void language sql security invoker set search_path='' as $$
  select barangayan_private.admin_request_transition(request_id,'accept');
$$;
create or replace function public.mark_request_ready_for_pickup(p_request_id uuid)
returns void language sql security invoker set search_path='' as $$
  select barangayan_private.admin_request_transition(p_request_id,'ready');
$$;
create or replace function public.complete_service_request(p_request_id uuid)
returns void language sql security invoker set search_path='' as $$
  select barangayan_private.admin_request_transition(p_request_id,'release');
$$;
create or replace function public.cancel_service_request(p_request_id uuid,p_note text)
returns void language sql security invoker set search_path='' as $$
  select barangayan_private.admin_request_transition(p_request_id,'cancel',p_note);
$$;
revoke all on function barangayan_private.admin_request_transition(uuid,text,text),
  public.begin_processing_request(uuid),public.mark_request_ready_for_pickup(uuid),
  public.complete_service_request(uuid),public.cancel_service_request(uuid,text) from public,anon;
grant execute on function barangayan_private.admin_request_transition(uuid,text,text),
  public.begin_processing_request(uuid),public.mark_request_ready_for_pickup(uuid),
  public.complete_service_request(uuid),public.cancel_service_request(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
