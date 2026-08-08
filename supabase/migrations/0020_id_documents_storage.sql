-- S0-8 / P1-F: store the resident's picked ID image instead of silently discarding it
-- on submit. Adds the path column on service_requests, creates the private
-- `id-documents` storage bucket, and scopes it so a resident can only read/write files
-- under their own auth.uid() folder.
alter table public.service_requests add column if not exists id_document_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('id-documents', 'id-documents', false, 5242880, array['image/jpeg', 'image/png', 'image/jpg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Objects are stored at `{auth.uid()}/{requestId}/id.{ext}` — storage.foldername(name)[1]
-- is the first path segment, i.e. the uploader's own uid.
create policy "residents upload own id docs"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'id-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "residents read own id docs"
on storage.objects for select to authenticated
using (
  bucket_id = 'id-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins need to review uploaded IDs against the requests they're processing — scoped to
-- their own barangay. Matched by id_document_path rather than assuming a fixed folder
-- structure: the object is uploaded before the service_requests row exists (residents
-- have no UPDATE/DELETE policy on service_requests, so the path can't be patched in
-- after the fact — see S0-8), so the request id is never part of the object path.
create policy "admins read barangay id docs"
on storage.objects for select to authenticated
using (
  bucket_id = 'id-documents'
  and public.current_role() = 'admin'
  and exists (
    select 1 from public.service_requests sr
    where sr.id_document_path = name
      and sr.barangay_id = public.current_barangay_id()
  )
);
