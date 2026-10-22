begin;

-- Keep the existing additional-member directory and lifecycle IDs. Attendance
-- columns, filters and sort keys now come only from tenant-owned active stays.
-- Holder-only households are reachable through the existing resident selector;
-- the household summary below counts holders as well as additional members.
do $$
declare definition text; target text;
begin
 foreach target in array array['admin_households_browse','admin_households_records'] loop
  definition := pg_get_viewdef(format('public.%I',target)::regclass,true);
  definition := replace(definition,'b.is_checked_in','(stay.id is not null)');
  definition := replace(definition,'b.checked_in_center_name','center.name');
  definition := replace(definition,'b.checked_in_at','stay.checked_in_at');
  definition := replace(definition,'to_jsonb(b.*)',
   $projection$to_jsonb(b.*) || jsonb_build_object('is_checked_in',stay.id is not null,'checked_in_at',stay.checked_in_at,
     'checked_in_center_id',stay.evacuation_center_id,'checked_in_center_name',center.name)$projection$);
  definition := replace(definition,'LEFT JOIN profiles p ON p.id = b.profile_id',
   'LEFT JOIN profiles p ON p.id = b.profile_id
    LEFT JOIN public.household_attendance stay ON stay.household_member_id=b.id
     AND stay.household_profile_id=p.id AND stay.barangay_id=p.barangay_id AND stay.checked_out_at IS NULL
    LEFT JOIN public.evacuation_centers center ON center.id=stay.evacuation_center_id');
  if position('LEFT JOIN public.household_attendance' in definition)=0 then
   raise exception 'Household projection anchor changed; inspect current definition';
  end if;
  if target='admin_households_browse' then
   definition := regexp_replace(definition,'WHERE ', 'WHERE p.deleted_at IS NULL AND p.role=''resident'' AND ');
  end if;
  execute format('create or replace view public.%I with (security_invoker=true) as %s',target,definition);
 end loop;
end $$;

create or replace view public.admin_households_summary with (security_invoker=true) as
with people as (
 select p.id as profile_id, null::uuid as member_id, p.barangay_id, 'holder'::text as relation
 from public.profiles p where p.role='resident' and p.deleted_at is null
 union all
 select m.profile_id,m.id,p.barangay_id,m.relation
 from public.household_members m join public.profiles p on p.id=m.profile_id
 where m.deleted_at is null and p.role='resident' and p.deleted_at is null
), allowed as (
 select person.*,stay.id is not null as checked_in
 from people person left join public.household_attendance stay
  on stay.household_profile_id=person.profile_id
  and stay.household_member_id is not distinct from person.member_id
  and stay.barangay_id=person.barangay_id and stay.checked_out_at is null
 where person.barangay_id=(select a.barangay_id from public.profiles a
  where a.id=(select auth.uid()) and a.role='admin' and a.deleted_at is null)
)
select jsonb_build_object('total',count(*),
 'checked_in',count(*) filter(where checked_in),
 'not_checked_in',count(*) filter(where not checked_in),
 'spouse',count(*) filter(where relation='spouse'),
 'child',count(*) filter(where relation='child'),
 'parent',count(*) filter(where relation='parent'),
 'other',count(*) filter(where member_id is not null and relation not in ('spouse','child','parent')),
 'holders',count(*) filter(where member_id is null)) as summary
from allowed having exists(select 1 from public.profiles a
 where a.id=(select auth.uid()) and a.role='admin' and a.deleted_at is null);

revoke all on public.admin_households_browse,public.admin_households_records,public.admin_households_summary from public,anon;
grant select on public.admin_households_browse,public.admin_households_records,public.admin_households_summary to authenticated;
notify pgrst,'reload schema';
commit;
