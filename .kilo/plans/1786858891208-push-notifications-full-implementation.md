# Push Notifications: Static Toggle → Fully Functional Real-Time System

## Goal
Replace the static `pushEnabled` local-state toggle in Settings (`apps/mobile/src/app/(app)/settings/index.tsx:32`) with a fully persisted, backend-connected push notification system that delivers real-time alerts for announcements, medical drive registrations, active medical drives, incidents, and service-request/payment status changes.

## Current State
- Toggle is `useState(true)` — no persistence, no backend, no delivery.
- `expo-notifications` is **not** in `apps/mobile/package.json`.
- No push-token storage table exists.
- All 5 target tables (`announcements`, `drive_registrations`, `medical_drives`, `incidents`, `service_requests`) are **already** in `supabase_realtime` publication.
- `profiles` table stores `theme_preference` — the established pattern for per-user persisted settings.

## Implementation Tasks

### 1. Database Migration — Profiles Column + Push Tokens Table
**File:** `supabase/migrations/0063_push_notifications.sql`

```sql
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
```

### 2. Shared Types / Schema Update
**File:** `packages/shared/src/types/database.ts`

Add `push_notifications_enabled` to `profiles.Row`, `profiles.Insert`, and `profiles.Update`.
Add `push_tokens` table types with `Row`, `Insert`, `Update`, and `Relationships`.

**File:** `packages/shared/src/schemas/settings.ts` (optional but recommended)

Add a `notificationPreferences` schema for future granular controls (keep the current global toggle working, but the schema is ready for per-category toggles later).

### 3. Mobile Dependency
**File:** `apps/mobile/package.json`

Add `expo-notifications` and `expo-task-manager`:
```
"expo-notifications": "~57.0.7",
"expo-task-manager": "~57.0.2"
```

Run `npx expo install expo-notifications expo-task-manager`.

### 4. Push Notification Service (Core)
**File:** `apps/mobile/src/lib/push-notifications.ts`

A module-level singleton that:
- Calls `Notifications.requestPermissionsAsync()` on first load.
- Calls `Notifications.getExpoPushTokenAsync()` and stores the token.
- Exposes `registerToken()`, `unregisterToken()`, `isEnabled`, `setEnabled()`.
- Wraps `Notifications.setNotificationHandler` for foreground presentation.
- Exposes `addNotificationResponseListener` for tap handling.

### 5. Notification Preferences Hook
**File:** `apps/mobile/src/hooks/use-notification-preferences.tsx`

Follow the exact pattern of `use-theme-preference.tsx`:
- Read `push_notifications_enabled` from `profiles` via `useProfile`.
- Local state mirror for instant UI response.
- `setPushEnabled(value)` writes to Supabase `profiles` table and triggers listener start/stop.

### 6. Realtime Notification Orchestrator Hook
**File:** `apps/mobile/src/hooks/use-notification-realtime.ts`

This is the delivery engine. It:
- Accepts `enabled: boolean` and `barangayId: string | null`.
- When `enabled && barangayId`, opens **5 Supabase realtime channels**, one per source table.
- Subscribes to `INSERT` on `announcements` filtered by `barangay_id`.
- Subscribes to `UPDATE` on `drive_registrations` filtered by `user_id=eq.${userId}`.
- Subscribes to `INSERT` on `medical_drives` filtered by `barangay_id` AND `is_active=true`.
- Subscribes to `UPDATE` on `incidents` filtered by `reporter_id=eq.${userId}`.
- Subscribes to `UPDATE` on `service_requests` filtered by `resident_id=eq.${userId}`.
- On each event, builds a title + body from the payload and calls `Notifications.scheduleNotificationAsync` (or `presentNotificationAsync` for immediate foreground alerts).
- Cleans up all channels on unmount or when `enabled` flips false.

**Channel naming convention (matches existing hooks):**
```
channel name | event | filter
announcements:{barangayId} | INSERT | barangay_id=eq.{barangayId}
drive_registrations:{userId} | UPDATE | user_id=eq.{userId}
medical_drives:{barangayId} | INSERT | barangay_id=eq.{barangayId} AND is_active=eq.true
incidents:{userId} | UPDATE | reporter_id=eq.{userId}
service_requests:{userId} | UPDATE | resident_id=eq.{userId}
```

### 7. Notification Templates
Centralize title/body builders in `apps/mobile/src/lib/notification-templates.ts`:

| Source | Trigger | Title | Body |
|--------|---------|-------|------|
| announcements | INSERT | `{title}` | `{body} (truncated to 100 chars)` |
| drive_registrations | UPDATE status | Registration Update | `Your application for "{drive_title}" is now {status}.` |
| medical_drives | INSERT | New Medical Drive | `"{title}" is now active on {drive_date}.` |
| incidents | UPDATE status | Incident Update | `Your reported incident "{title}" is now {status}.` |
| service_requests | UPDATE status or payment_status | Request Update | `Your document request {reference_number} is {status}.` + payment note if `paid` |

### 8. App-Level Integration (Auto-Start)
**File:** `apps/mobile/src/app/_layout.tsx`

Inside `RootLayout`, after `<ThemePreferenceProvider>`, add a `<NotificationProvider>` that:
- Mounts `usePushNotifications` to register the token on auth change.
- Mounts `useNotificationRealtime` (reads `pushEnabled` from the preferences hook).
- Wraps `ThemedRoot` so the listener is alive for the entire app session.

### 9. Settings Screen Wiring
**File:** `apps/mobile/src/app/(app)/settings/index.tsx`

Replace lines 32-34 and 105-125:
- Import `useNotificationPreferences`.
- Replace `const [pushEnabled, setPushEnabled]` with the hook's returned state + setter.
- Keep SMS toggle as local-only (out of scope unless user asks for it).

### 10. Edge Case Handling
- **Guest users:** `useNotificationPreferences` should return `false` / no-op when `session` is null (no profile to persist to, no realtime to listen).
- **Token refresh:** On app foreground, re-fetch token and `upsert_push_token` if changed.
- **Permission denied:** Log warning; do not crash. Re-request on next toggle on.
- **RLS:** All realtime filters use `eq.{userId}` or `eq.{barangayId}` so Supabase RLS still enforces row-level access.

## Validation Steps
1. `npm run lint` in `apps/mobile`.
2. `npx tsc --noEmit` in `apps/mobile` and `packages/shared`.
3. Manual smoke test:
   - Toggle Push ON → observe token upsert in Supabase `push_tokens`.
   - Toggle Push OFF → observe realtime channels unsubscribe.
   - As admin, post announcement → resident receives foreground notification.
   - Admin updates drive registration status → resident receives notification.
   - Admin posts new medical drive → resident receives notification.
   - Admin updates incident status → resident receives notification.
   - Admin updates service request status/payment → resident receives notification.

## Out of Scope
- SMS notifications (separate toggle, no backend requested).
- Granular per-category notification toggles (global on/off only for this pass).
- Server-side (Edge Function) push relay for killed-app state — client-side realtime + `expo-notifications` covers foreground and background on both platforms for this implementation.
- Push notification deep-link navigation (tap handler logs payload only; routing deferred).
