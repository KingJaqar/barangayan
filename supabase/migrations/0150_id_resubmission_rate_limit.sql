begin;

-- ID resubmission limits, enforced where the version is created:
--  * Replacing a submission that is pending or verified: one version per hour.
--  * After staff reject (verification_failed or revoked), the resident may retry at
--    once. The third consecutive rejection locks submissions for one hour, counted
--    from the staff decision. The count then carries on, so every further run of
--    three rejections locks again.
-- The first version is never delayed. A lost-response retry of the same submission
-- id returns earlier in the function, so it stays idempotent. The profile row lock
-- taken earlier in the function serializes concurrent submissions.
-- Patch the current function in place, as 0118 does, so later edits are kept.
do $migration$
declare
  v_definition text := pg_get_functiondef('barangayan_private.publish_id_submission(jsonb)'::regprocedure);
  v_anchor constant text := 'select coalesce(max(version),0)+1 into v_version from public.id_submissions where resident_id=v_actor.id;';
  v_guard constant text := $guard$declare v_last public.id_submissions; v_rejected integer;
  begin
    select * into v_last from public.id_submissions where resident_id=v_actor.id order by version desc limit 1;
    if found then
      if v_last.decision in ('verification_failed','revoked') then
        select count(*) into v_rejected from public.id_submissions s
          where s.resident_id=v_actor.id and s.decision in ('verification_failed','revoked')
            and s.version > coalesce((select max(n.version) from public.id_submissions n
              where n.resident_id=v_actor.id and n.decision not in ('verification_failed','revoked')),0);
        if v_rejected % 3 = 0 and v_last.reviewed_at > clock_timestamp() - interval '60 minutes' then
          raise exception 'id_resubmission_rate_limited' using errcode='54000';
        end if;
      elsif v_last.submitted_at > clock_timestamp() - interval '60 minutes' then
        raise exception 'id_resubmission_rate_limited' using errcode='54000';
      end if;
    end if;
  end;
  $guard$;
begin
  if position(v_anchor in v_definition) = 0 then
    raise exception 'id_publication_version_lookup_not_found';
  end if;
  execute replace(v_definition, v_anchor, v_guard || v_anchor);
end $migration$;

commit;
