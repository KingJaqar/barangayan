-- ============================================================================
-- Storage bucket for site content assets (About Us logo, developer photos)
-- ============================================================================
-- Path convention: {barangay_id}/logo.{ext} and {barangay_id}/developers/{uuid}.{ext}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-content', 'site-content', true, 5242880, array['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
on conflict (id) do nothing;

create policy "admins upload site-content"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'site-content'
    and public.current_role() = 'admin'
    and (storage.foldername(name))[1] = public.current_barangay_id()::text
  );

create policy "public read site-content"
  on storage.objects for select to anon
  using (bucket_id = 'site-content');

create policy "authenticated read site-content"
  on storage.objects for select to authenticated
  using (bucket_id = 'site-content');

create policy "admins delete site-content"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'site-content'
    and public.current_role() = 'admin'
    and (storage.foldername(name))[1] = public.current_barangay_id()::text
  );
