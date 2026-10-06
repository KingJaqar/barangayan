begin;
-- Release only after 0105, the resident response/export projections, and the
-- administrator protected-score join are installed. No score values remain in
-- this compatibility column after 0105; this removes its obsolete API contract.
alter table public.drive_registrations drop column if exists priority_score;
notify pgrst,'reload schema';
commit;
