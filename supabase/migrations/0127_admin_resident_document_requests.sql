-- An administrator role supplements resident capabilities; it does not disqualify
-- the same active profile from requesting its own documents.
begin;

-- Restrict the change to owner operations. Do not relax assert_actor(false), which
-- also protects resident-only account setup/deletion workflows elsewhere.
-- Preserve current fee, evidence, idempotency, ownership and tenant checks.
do $$
declare signature text; definition text; old_call text; new_call text;
begin
  foreach signature in array array[
    'barangayan_private.publish_id_submission(jsonb)',
    'barangayan_private.submit_service_request(jsonb)',
    'barangayan_private.set_request_payment_method(uuid,text)',
    'barangayan_private.pickup_payment(uuid,boolean)'
  ] loop
    definition := pg_get_functiondef(signature::regprocedure);
    if signature = 'barangayan_private.pickup_payment(uuid,boolean)' then
      old_call := 'barangayan_private.assert_actor(p_collect)';
      new_call := 'barangayan_private.assert_actor(p_collect or public.current_role() = ''admin'')';
    else
      old_call := 'barangayan_private.assert_actor()';
      new_call := 'barangayan_private.assert_actor(public.current_role() = ''admin'')';
    end if;
    if position(old_call in definition) = 0 then
      raise exception 'request_actor_check_not_found: %', signature;
    end if;
    execute replace(definition, old_call, new_call);
  end loop;

  definition := pg_get_functiondef('barangayan_private.guard_request_foundations()'::regprocedure);
  old_call := 'where id = new.resident_id and role = ''resident'' and deleted_at is null';
  if position(old_call in definition) = 0 then
    raise exception 'request_owner_check_not_found';
  end if;
  execute replace(definition, old_call,
    'where id = new.resident_id and role in (''resident'',''admin'') and deleted_at is null');
end $$;

-- Supporting files remain private, owned, insert-only and limited to active users.
alter policy "residents upload private supporting files" on storage.objects
with check (bucket_id = 'request-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$'
  and exists(select 1 from public.profiles p where p.id = (select auth.uid())
    and p.role in ('resident','admin') and p.deleted_at is null));

commit;
