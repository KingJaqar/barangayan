-- Real, persisted App Theme (Light/Dark + accent color) for the Settings screen —
-- logged-in users only (guests get local-only state, no profile to persist to).
alter table public.profiles
  add column theme_preference text not null default 'system'
    check (theme_preference in ('light', 'dark', 'system')),
  add column accent_color text not null default '#0F6E5B';
