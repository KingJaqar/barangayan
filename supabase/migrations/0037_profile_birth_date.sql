-- Module 10 (Health) needs the registrant's age for priority scoring.
-- Rather than ask the user to re-type their age each time, we store birth_date
-- on the profile so it can be displayed pre-filled in the Applicant Registration
-- screen.  age is derived at registration time as
--   date_part('year', age(now(), birth_date))
-- and stored on drive_registrations.age (no duplication at rest).

alter table public.profiles
  add column if not exists birth_date date;

comment on column public.profiles.birth_date is
  'Optional date of birth (YYYY-MM-DD) used to pre-fill the age field on '
  'the Applicant Registration screen (Module 10 — Health & Medical Drives).';
