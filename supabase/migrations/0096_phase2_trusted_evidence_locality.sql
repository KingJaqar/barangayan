begin;

-- Keep unknown historical review provenance explicit, never invent a reviewer/date.
alter table public.id_submissions add column evidence_origin text not null default 'resident_upload'
  check (evidence_origin in ('resident_upload','legacy_approval','legacy_pending'));
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid='public.id_submissions'::regclass
    and contype='c' and pg_get_constraintdef(oid) like '%reviewed_by%' loop
    execute format('alter table public.id_submissions drop constraint %I',c.conname);
  end loop;
end $$;
alter table public.id_submissions add constraint id_submissions_review_provenance check (
  (decision='pending' and reviewed_by is null and reviewed_at is null and rejection_reason is null)
  or (decision <> 'pending' and reviewed_by is not null and reviewed_at is not null
    and (decision='verified' or length(btrim(rejection_reason)) between 1 and 1000))
  or (evidence_origin='legacy_approval' and decision='verified' and reviewed_by is null
    and reviewed_at is null and rejection_reason is null));

-- Import only complete, owned, existing image pairs. Inconsistent records remain
-- available to staff for repair and cannot be mistaken for current approval.
do $$ declare p public.profiles; v_id uuid; v_front text; v_back text; begin
  for p in select existing.* from public.profiles existing join public.barangay_localities l on l.barangay_id=existing.barangay_id
    where existing.role='resident' and existing.deleted_at is null and existing.current_id_submission_id is null
    and existing.id_verification_status in ('verified','pending') loop
    v_front:=p.id_photo_urls[1]; v_back:=p.id_photo_urls[2];
    if cardinality(p.id_photo_urls)=2 and v_front<>v_back and length(btrim(p.id_type)) between 1 and 200
      and v_front like p.id::text || '/%' and v_back like p.id::text || '/%'
      and (select count(*) from storage.objects o where o.bucket_id='id-documents' and o.name in (v_front,v_back)
        and case when o.metadata->>'size' ~ '^[0-9]{1,8}$' then (o.metadata->>'size')::bigint between 1 and 5242880 else false end
        and o.metadata->>'mimetype' in ('image/jpeg','image/jpg','image/png','image/webp'))=2 then
      v_id:=gen_random_uuid();
      insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
      values(v_id,p.id,p.barangay_id,1,p.id_type,v_front,v_back,
        case when p.id_verification_status='verified' then 'verified' else 'pending' end,
        case when p.id_verification_status='verified' then 'legacy_approval' else 'legacy_pending' end);
      update public.profiles set current_id_submission_id=v_id,
        approved_id_submission_id=case when p.id_verification_status='verified' then v_id else null end,
        id_repair_required=false where id=p.id;
    elsif p.id_verification_status='verified' then
      update public.profiles set id_repair_required=true where id=p.id;
    end if;
  end loop;
end $$;

-- Restrictive policies also protect imported paths against any permissive policy.
create policy "ID evidence cannot be overwritten" on storage.objects as restrictive for update to authenticated
using (bucket_id <> 'id-documents') with check (bucket_id <> 'id-documents');
create policy "ID evidence cannot be deleted by clients" on storage.objects as restrictive for delete to authenticated
using (bucket_id <> 'id-documents');

create function barangayan_private.enforce_profile_locality() returns trigger
language plpgsql security invoker set search_path='' as $$
declare l public.barangay_localities; begin
  select * into l from public.barangay_localities where barangay_id=new.barangay_id;
  if not found then return new; end if;
  if tg_op='UPDATE' and current_user in ('authenticated','anon')
    and new.home_address is distinct from old.home_address and new.house_no is not distinct from old.house_no
    and new.street is not distinct from old.street then
    raise exception 'derived_address' using errcode='42501';
  end if;
  if tg_op='UPDATE' and current_user in ('authenticated','anon') and
    ((new.city is distinct from old.city and new.city is distinct from l.city)
      or (new.province is distinct from old.province and new.province is distinct from l.province)) then
    raise exception 'fixed_locality' using errcode='42501';
  end if;
  new.city:=l.city; new.province:=l.province;
  return new;
end $$;
revoke all on function barangayan_private.enforce_profile_locality() from public,anon,authenticated;
create trigger b_enforce_profile_locality before insert or update on public.profiles
for each row execute function barangayan_private.enforce_profile_locality();

-- Recompose only when structured address content exists. A locality backfill
-- must not replace an unsplittable historical free-text address with just a city.
create or replace function public.compose_profile_display_fields() returns trigger
language plpgsql set search_path='' as $$
declare l public.barangay_localities; v_name text; begin
  if coalesce(nullif(trim(new.first_name),''),nullif(trim(new.middle_name),''),nullif(trim(new.last_name),''),nullif(trim(new.suffix),'')) is not null then
    new.full_name:=concat_ws(' ',nullif(trim(new.first_name),''),nullif(trim(new.middle_name),''),nullif(trim(new.last_name),''),nullif(trim(new.suffix),''));
  end if;
  if nullif(trim(new.house_no),'') is not null or nullif(trim(new.street),'') is not null then
    select * into l from public.barangay_localities where barangay_id=new.barangay_id;
    select name into v_name from public.barangays where id=new.barangay_id;
    new.home_address:=concat_ws(', ',nullif(trim(concat_ws(' ',nullif(trim(new.house_no),''),nullif(trim(new.street),''))),''),
      coalesce(l.display_name,v_name),nullif(trim(new.city),''),nullif(trim(new.province),''));
  end if;
  return new;
end $$;
update public.profiles p set city=l.city,province=l.province
from public.barangay_localities l where p.barangay_id=l.barangay_id
  and (p.city is distinct from l.city or p.province is distinct from l.province);

-- Evidence fields on configured tenants are exclusively published/reviewed via RPCs.
create function barangayan_private.require_id_operations() returns trigger
language plpgsql security invoker set search_path='' as $$ begin
  if current_setting('role',true) in ('authenticated','anon')
    and exists(select 1 from public.barangay_localities where barangay_id=old.barangay_id)
    and (new.id_type is distinct from old.id_type or new.id_photo_urls is distinct from old.id_photo_urls
      or new.id_verification_status is distinct from old.id_verification_status)
    and current_user in ('authenticated','anon') then
    raise exception 'use_ID_version_operations' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function barangayan_private.require_id_operations() from public,anon,authenticated;
create trigger a_require_id_operations before update on public.profiles
for each row execute function barangayan_private.require_id_operations();

-- Successful replacement resolves the repair flag; unrelated edits never do.
create function barangayan_private.clear_id_repair_on_publication() returns trigger
language plpgsql set search_path='' as $$ begin
  if new.current_id_submission_id is distinct from old.current_id_submission_id and new.current_id_submission_id is not null then
    new.id_repair_required:=false;
  end if;
  return new;
end $$;
revoke all on function barangayan_private.clear_id_repair_on_publication() from public,anon,authenticated;
create trigger z_clear_id_repair_on_publication before update on public.profiles
for each row execute function barangayan_private.clear_id_repair_on_publication();
commit;
