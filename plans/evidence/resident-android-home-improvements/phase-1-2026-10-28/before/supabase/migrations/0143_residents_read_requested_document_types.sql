-- Residents could only read ACTIVE document types, so once an admin retired a service the
-- embedded document_types(name) on that resident's own past requests came back null and
-- Logs/Requests fell back to the generic "Document Request" title. Let a resident read the
-- catalog rows their own requests point at, whether or not the type is still offered.
-- Not applied to hosted; rehearse on a clone first.
create policy "residents can read document types of their own requests"
  on public.document_types for select
  to authenticated
  using (
    exists (
      select 1 from public.service_requests r
      where r.document_type_id = document_types.id
        and r.resident_id = (select auth.uid())
    )
  );
