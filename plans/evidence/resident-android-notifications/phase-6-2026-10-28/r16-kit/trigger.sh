#!/bin/bash
# R16 kit — creates ONE real event (inbox row + alert outbox row) for the seeded tester resident in the isolated database.
# Usage: NOTIF_TEST_DB=notif_r16_20261028 bash trigger.sh notice|account|incident
# Then run `node send.mjs` to deliver it through Expo to the phone.
set -e
: "${NOTIF_TEST_DB:?set NOTIF_TEST_DB to the disposable notif_* database}"
case "$NOTIF_TEST_DB" in notif_*) ;; *) echo "refusing: not a notif_* database"; exit 1;; esac
C=${NOTIF_DB_CONTAINER:-supabase_db_barangayan}
B=5e0d0000-0000-4000-8000-000000000001   # seeded barangay
A=5e0d0000-0000-4000-8000-0000000000a1   # tester resident (rwfb-populated@test.local)
AD=5e0d0000-0000-4000-8000-0000000000ad  # seeded admin
I=5e0d0000-0000-4000-8000-0000000000d1   # seeded incident reported by the tester
stamp=$(date +%H%M%S)
psql_() { MSYS_NO_PATHCONV=1 docker exec -i "$C" psql -U supabase_admin -d "$NOTIF_TEST_DB" -X -q -At -v ON_ERROR_STOP=1; }
case "$1" in
  notice)
    psql_ <<SQL
set role service_role;
select public.system_notice_publish(public.system_notice_create('service_status','$B','R16 test notice $stamp','Real-device delivery check for the Announcements hub.','$AD',null,null,null,null,null,null,null,true));
select public.notification_publish_due_notices(100);
SQL
    ;;
  account)
    psql_ <<SQL
select barangayan_private.emit_notification_v2(array['$A'::uuid],'$B','account_security','account',gen_random_uuid(),'r16-$stamp','R16 account alert $stamp','Open to review your account settings.','{"v":2,"kind":"account","screen":"settings"}',true);
SQL
    ;;
  incident)
    psql_ <<SQL
begin;
select set_config('request.jwt.claim.sub','$AD',true), set_config('request.jwt.claims','{"sub":"$AD","role":"authenticated"}',true);
update public.incidents set status=case status when 'open' then 'in_progress' when 'in_progress' then 'resolved' else 'in_progress' end where id='$I';
commit;
SQL
    ;;
  *) echo "usage: trigger.sh notice|account|incident"; exit 1;;
esac
echo "event created ($1). Now run: node send.mjs"
