-- 1. Add global on/off to profiles (follows theme_preference pattern)
alter table public.profiles
  add column if not exists push_notifications_enabled boolean not null default true;

comment on column public.profiles.push_notifications_enabled is
  'Global opt-in for real-time push notifications.';

-- 2. Push tokens table — one row per device/token so multi-device users get
--    deliveries on every registered handset.
create table public.push_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  device_type  text not null check (device_type in ('ios', 'android')),
  last_used_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

comment on table public.push_tokens is
  'Expo push tokens per user/device for real-time notification delivery.';

alter table public.push_tokens enable row level security;

create policy "users can manage their own push tokens"
  on public.push_tokens for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. RPC: upsert_push_token — idempotent token registration from the client.
create or replace function public.upsert_push_token(
  p_expo_push_token text,
  p_device_type text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.push_tokens (user_id, expo_push_token, device_type)
  values (auth.uid(), p_expo_push_token, p_device_type)
  on conflict (user_id, expo_push_token) do update
    set last_used_at = now(),
        device_type = excluded.device_type;
end;
$$;
