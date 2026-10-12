import { sql } from './runtime-stack.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
assert.equal(sql('select count(*) from public.incidents;'), '1505');
sql(`begin;
update public.medical_drives set drive_date=(current_timestamp at time zone 'Asia/Manila')::date + (right(id::text,4)::int%3-1),
 is_active=right(id::text,4)::int%5<>0,
 type=(case when right(id::text,4)::int%2=0 then 'dental' else 'consultation' end)::drive_type,
 eligible_criteria=case when right(id::text,4)::int between 1 and 23 then 'Phase5 partial fixture' when right(id::text,4)::int=1505 then 'Beyond Cap Needle' else eligible_criteria end
where barangay_id='10000000-0000-4000-8000-000000000001';
update public.incidents set status=(array['open','in_progress','resolved','withdrawn','unresolved'])[right(id::text,4)::int%5+1],
 description=case when right(id::text,4)::int between 1 and 23 then 'Phase5 partial fixture' else description end,
 confirmation_count=right(id::text,4)::int%7;
update public.drive_registrations set status=((array['pending','confirmed','attended','cancelled'])[right(id::text,4)::int%4+1])::drive_registration_status,
 comorbidities=case when right(id::text,4)::int between 1 and 23 then array['Phase5 partial fixture'] when right(id::text,4)::int=1505 then array['Beyond Cap Needle'] else comorbidities end;
update public.profiles set full_name=case right(id::text,4) when '0001' then '  alpha Duplicate  ' when '0002' then 'ALPHA duplicate' when '0003' then 'Álpha Duplicate' when '0004' then '' when '0005' then repeat('Long Name Ω ',40) else full_name end where id::text like '20000000-%';
update public.incidents set title=case right(id::text,4) when '0001' then '  alpha Duplicate  ' when '0002' then 'ALPHA duplicate' when '0003' then 'Álpha Duplicate' when '0004' then '' when '0005' then repeat('Long Title Ω ',40) else title end;
update public.medical_drives set title=case right(id::text,4) when '0001' then '  alpha Duplicate  ' when '0002' then 'ALPHA duplicate' when '0003' then 'Álpha Duplicate' when '0004' then '' when '0005' then repeat('Long Title Ω ',40) else title end where barangay_id='10000000-0000-4000-8000-000000000001';
commit;`);
const facts = JSON.parse(sql(`select jsonb_build_object('today',(current_timestamp at time zone 'Asia/Manila')::date,
 'registrationTotal',(select count(*) from drive_registrations),
 'cancelled',(select count(*) from drive_registrations where status='cancelled'),
 'missingScores',(select count(*) from drive_registrations r left join drive_registration_scores s on s.registration_id=r.id where s.registration_id is null),
 'missingProfile',(select count(*) from drive_registrations r left join profiles p on p.id=r.user_id where p.id is null));`));
fs.writeFileSync(new URL('./fixture-cases.json', import.meta.url), JSON.stringify(facts, null, 2));
console.log(JSON.stringify(facts));
