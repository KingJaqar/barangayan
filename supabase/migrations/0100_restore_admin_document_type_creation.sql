begin;

-- Administrators may add document types alongside the four configured charter
-- services. Keep existing tenant/admin RLS and charter-contract validation intact.
drop trigger if exists guard_pilot_catalog_scope on public.document_types;
drop function if exists barangayan_private.guard_pilot_catalog_scope();

commit;
