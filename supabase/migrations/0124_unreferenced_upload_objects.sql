-- Resident iOS Phase 3 (P03-T07, closes P02-D10): server-side orphan discovery for the
-- private upload buckets. Residents have no delete policy on `request-attachments` or
-- `id-documents`, so objects uploaded before a submission that never committed can only
-- be removed by a trusted worker. This read-only routine lists candidates; deletion must
-- go through the Storage API (deleting `storage.objects` rows would leave the files).
begin;

create function barangayan_private.unreferenced_upload_objects(p_bucket text, p_min_age interval default interval '7 days')
returns table(object_name text, created_at timestamptz)
language sql stable security definer set search_path='' as $$
 select o.name, o.created_at
 from storage.objects o
 where o.bucket_id=p_bucket
   and p_bucket in ('request-attachments','id-documents')
   -- Never list objects young enough to belong to an upload still in progress.
   and o.created_at<now()-greatest(coalesce(p_min_age,interval '7 days'),interval '1 hour')
   and case p_bucket
     when 'request-attachments' then
       not exists(select 1 from public.request_attachments a where a.object_path=o.name)
     else
       not exists(select 1 from public.id_submissions s where o.name in (s.front_path,s.back_path))
       and not exists(select 1 from public.service_requests r where r.id_document_path=o.name)
       and not exists(select 1 from public.profiles p where o.name=any(p.id_photo_urls))
   end
 order by o.created_at,o.name
$$;
revoke all on function barangayan_private.unreferenced_upload_objects(text,interval) from public,anon,authenticated;
grant execute on function barangayan_private.unreferenced_upload_objects(text,interval) to service_role;
comment on function barangayan_private.unreferenced_upload_objects(text,interval) is
 'Service-role discovery of private-bucket objects with no database reference older than the minimum age (at least one hour). Read-only; a worker deletes through the Storage API.';

commit;
