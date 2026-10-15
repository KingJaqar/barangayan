begin;

-- Front-only submissions carry the resident's confirmed, immutable review data.
-- Existing two-sided versions and approval provenance remain intact.
alter table public.id_submissions alter column back_path drop not null;
alter table public.id_submissions add column confirmed_details jsonb;
alter table public.id_submissions add constraint id_submissions_front_details_required
  check (back_path is not null or confirmed_details is not null);

create or replace function barangayan_private.publish_id_submission(p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_actor public.profiles; v_profile public.profiles; v_old public.id_submissions;
  v_id uuid; v_type text; v_front text; v_back text; v_prefix text; v_version integer;
  v_details jsonb; v_name text; v_number text; v_birth text; v_address text;
begin
  v_actor := barangayan_private.assert_actor();
  perform barangayan_private.check_keys(p_input,array['submissionId','idType','frontPath','backPath','confirmedDetails']);
  v_id := barangayan_private.required_text(p_input,'submissionId',36)::uuid;
  v_type := barangayan_private.required_text(p_input,'idType',200);
  v_front := barangayan_private.required_text(p_input,'frontPath',500);
  v_back := barangayan_private.optional_text(p_input,'backPath',500);
  if p_input ? 'confirmedDetails' then
    v_details := p_input->'confirmedDetails';
    perform barangayan_private.check_keys(v_details,array['fullName','idNumber','birthDate','address']);
    v_name := barangayan_private.required_text(v_details,'fullName',200);
    -- Optional front fields use empty strings, never invented profile values.
    if not (v_details ?& array['idNumber','birthDate','address']) then
      raise exception 'invalid_confirmed_details' using errcode='22023';
    end if;
    v_number := barangayan_private.optional_text(v_details,'idNumber',200);
    v_birth := barangayan_private.optional_text(v_details,'birthDate',10);
    v_address := barangayan_private.optional_text(v_details,'address',1000);
    if v_birth is not null then
      if v_birth !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or v_birth like '0000-%' then
        raise exception 'invalid_birth_date' using errcode='22023';
      end if;
      begin
        if to_char(v_birth::date,'YYYY-MM-DD') <> v_birth or v_birth::date > current_date then
          raise exception 'invalid_birth_date' using errcode='22023';
        end if;
      exception when datetime_field_overflow or invalid_datetime_format then
        raise exception 'invalid_birth_date' using errcode='22023';
      end;
    end if;
    v_details := jsonb_build_object('fullName',v_name,'idNumber',coalesce(v_number,''),'birthDate',coalesce(v_birth,''),'address',coalesce(v_address,''));
  elsif v_back is null then
    raise exception 'confirmed_details_required' using errcode='22023';
  end if;
  v_prefix := v_actor.id::text || '/versions/' || v_id::text || '/';
  if v_front !~ ('^' || v_prefix || 'id-front\.(jpg|jpeg|png|webp)$') or
    (v_back is not null and v_back !~ ('^' || v_prefix || 'id-back\.(jpg|jpeg|png|webp)$')) then
    raise exception 'invalid_ID_version_path' using errcode='22023';
  end if;
  select * into v_profile from public.profiles where id=v_actor.id and deleted_at is null for update;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  select * into v_old from public.id_submissions where id=v_id;
  if found then
    if v_old.resident_id <> v_actor.id or v_old.id_type <> v_type or v_old.front_path <> v_front
      or v_old.back_path is distinct from v_back or v_old.confirmed_details is distinct from v_details then
      raise exception 'idempotency_conflict' using errcode='22023';
    end if;
    return v_id;
  end if;
  perform barangayan_private.check_object('id-documents',v_front);
  if v_back is not null then perform barangayan_private.check_object('id-documents',v_back); end if;
  select coalesce(max(version),0)+1 into v_version from public.id_submissions where resident_id=v_actor.id;
  insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,confirmed_details)
    values(v_id,v_actor.id,v_actor.barangay_id,v_version,v_type,v_front,v_back,v_details);
  update public.profiles set current_id_submission_id=v_id,approved_id_submission_id=null,
    id_type=v_type,id_photo_urls=array_remove(array[v_front,v_back],null),id_verification_status='pending' where id=v_actor.id;
  return v_id;
end $$;

-- Preserve the current service submission implementation (including later
-- migrations), making only its back-evidence check conditional.
do $$
declare v_definition text;
begin
  v_definition := pg_get_functiondef('barangayan_private.submit_service_request(jsonb)'::regprocedure);
  if position('perform barangayan_private.check_object(''id-documents'',s.back_path);' in v_definition) = 0 then
    raise exception 'service_submission_back_check_not_found';
  end if;
  execute replace(v_definition,
    'perform barangayan_private.check_object(''id-documents'',s.back_path);',
    'if s.back_path is not null then perform barangayan_private.check_object(''id-documents'',s.back_path); end if;');
end $$;

-- Limit paid OCR requests atomically per resident. No image/text in this table.
create table barangayan_private.id_extraction_limits (
  resident_id uuid primary key references public.profiles(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0)
);
alter table barangayan_private.id_extraction_limits enable row level security;
revoke all on barangayan_private.id_extraction_limits from public,anon,authenticated,service_role;
create function public.consume_id_extraction_limit(p_resident_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_window timestamptz := date_bin('1 minute',clock_timestamp(),timestamptz '2000-01-01 00:00:00+00'); v_count integer;
begin
  insert into barangayan_private.id_extraction_limits as l(resident_id,window_start,request_count)
    values(p_resident_id,v_window,1)
    on conflict(resident_id) do update set window_start=v_window,
      request_count=case when l.window_start=v_window then l.request_count+1 else 1 end
    returning request_count into v_count;
  return v_count <= 5;
end $$;
revoke all on function public.consume_id_extraction_limit(uuid) from public,anon,authenticated;
grant execute on function public.consume_id_extraction_limit(uuid) to service_role;

commit;
