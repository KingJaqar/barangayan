-- Adds an optional, longer-form "detailed description" to announcements — shown in the
-- resident app's Announcement Modal when a resident taps a card for more detail. `body`
-- stays the short summary shown on the card itself (truncated client-side to 2 sentences);
-- `detailed_description` is the expanded write-up. Falls back to `body` in the UI when
-- NULL/empty (announcements composed before this field existed).

alter table public.announcements
  add column if not exists detailed_description text;

comment on column public.announcements.detailed_description is
  'Optional expanded write-up shown in the resident app''s Announcement Modal. NULL/empty '
  'falls back to `body` in the UI.';
