-- Resident Account notifications: sign-ins and ended sessions (owner decision 2026-10-28, beyond
-- the plan's A22 "new device" event, which cannot be told apart reliably on Android).
--
--   * A22S: every new Auth session of a usable resident account is a sign-in. It may alert: the
--     session is created by Supabase Auth, never by a resident session, so account_notify keeps it
--     alertable. The key is the session id, so a retried insert never doubles it.
--   * A22E: a deleted session is history only. Auth deletes sessions on sign-out, but also on
--     expiry clean-up and when other sessions are revoked, so the copy says "ended", not "signed
--     out". Every session one statement removes for a resident is one event (global sign-out).
--   * Both go through account_notify, so nothing is written while the activation gate is off, and
--     a failure becomes a warning: a notification never blocks Auth.

create or replace function barangayan_private.account_event_copy(p_code text)
returns table(code text, kind text, title text, body text, screen text)
language sql immutable set search_path='' as $$
  select c.code,c.kind,c.title,c.body,c.screen from (values
    ('A01','account_profile','Your account is ready','You can now use Barangayan with your resident account.','settings'),
    ('A03','account_profile','Your profile was updated','Your resident details changed. Open your profile to review them.','profile'),
    ('A05','account_profile','Household details updated','Your household information changed. Review the saved details in your profile.','profile'),
    ('A07','account_verification','ID submitted for review','Barangay staff will review your submitted ID. You can check its status in Valid ID.','valid_id'),
    ('A08','account_verification','Your ID is verified','Your submitted ID has been approved. Open Valid ID to review your status.','valid_id'),
    ('A09','account_verification','Your ID needs attention','Your ID could not be verified. Open Valid ID to review the reason and submit a replacement.','valid_id'),
    ('A10','account_verification','ID verification changed','Your ID verification is no longer active. Review the reason and the next steps in Valid ID.','valid_id'),
    ('A11','account_verification','Replacement ID submitted','Your replacement ID is pending review. Your current status is available in Valid ID.','valid_id'),
    ('A12','account_verification','Resubmit your ID','Your ID record needs an update. Please submit a clear front photo and confirm its details.','valid_id'),
    ('A14','account_verification','Email verified','Your current email address has been confirmed.','email_verification'),
    ('A15','account_verification','Verify your updated email','Your contact email changed. Confirm the new address in Email Verification.','email_verification'),
    ('A18','account_security','Password added','You can now sign in with your email and password.','change_password'),
    ('A19','account_security','Password updated','Your Barangayan password was updated. If this wasn''t you, recover your account.','change_password'),
    ('A22S','account_security','New sign-in to your account','Your Barangayan account was just signed in on a device. If this wasn''t you, change your password right away.','change_password'),
    ('A22E','account_security','A sign-in session ended','One of your signed-in sessions ended, for example after signing out. Open Settings to review your account.','settings'),
    ('A31','request_status','Document request received','Your document request was submitted. Open it to check its status and next steps.',null),
    ('A32','request_status','Your request needs attention','Processing of your document request is on hold until you respond. Open it to see what is needed.',null),
    ('A33','payment','Payment is needed for your request','Your document request has a confirmed fee. Open the request to review the amount and available payment methods.',null),
    ('A37','request_status','Request processing updated','Processing of your document request has an update. Open it to review the reason and next steps.',null),
    ('A40','request_status','Document request cancelled','Your document request was cancelled. Open it to review the details.',null),
    ('A43','payment','Your payment needs attention','Your payment attempt was not completed. Check the request''s latest payment status before trying again.',null),
    ('A44P','payment','Your refund has an update','A refund for your document request was started. Open the request to follow its status.',null),
    ('A44S','payment','Your refund has an update','A refund for your document request is being processed. It has not been returned yet.',null),
    ('A44D','payment','Your refund has an update','A refund for your document request was confirmed. Open the request to review the details.',null),
    ('A44F','payment','Your refund has an update','A refund for your document request could not be completed. Open the request to review what to do next.',null),
    ('A45','request_status','Document request details updated','Details of your document request changed. Open it to review the latest information.',null),
    ('A46','incident_status','Incident report submitted','Your incident report was submitted to the barangay. Open it to check its status.',null),
    ('A50','incident_status','Incident report withdrawn','Your incident report was withdrawn. The barangay will no longer act on it.',null)
  ) c(code,kind,title,body,screen) where c.code=p_code
$$;
revoke all on function barangayan_private.account_event_copy(text) from public,anon,authenticated,service_role;

create or replace function barangayan_private.notify_auth_session() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    perform barangayan_private.account_notify('A22S',new.user_id,'session:'||new.id||':signed_in','account',new.user_id,null,false);
  else
    perform barangayan_private.account_notify('A22E',old.user_id,'session_end:'||old.user_id||':'||barangayan_private.occurrence_token(),'account',old.user_id,null,true);
  end if;
  return null;
exception when others then
  raise warning 'notify_auth_session failed: %',sqlstate;
  return null;
end $$;
revoke all on function barangayan_private.notify_auth_session() from public,anon,authenticated,service_role;

drop trigger if exists z_notify_auth_session_ins on auth.sessions;
create trigger z_notify_auth_session_ins after insert on auth.sessions
  for each row execute function barangayan_private.notify_auth_session();
drop trigger if exists z_notify_auth_session_del on auth.sessions;
create trigger z_notify_auth_session_del after delete on auth.sessions
  for each row execute function barangayan_private.notify_auth_session();
