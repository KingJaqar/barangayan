# Evacuation Centers Admin Screen Implementation Plan

## Overview
Replace the static placeholder at `apps/web/src/app/(admin)/evacuation-centers/page.tsx` with a fully functional CRUD screen mirroring the Announcements admin screen pattern, including real-time synchronization.

## Database Schema (evacuation_centers)
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | uuid | Auto | PK |
| barangay_id | uuid | Yes | FK to barangays |
| name | text | Yes | |
| address | text | No | |
| position | jsonb | Yes | {lat: number, lng: number} |
| capacity | integer | No | |
| current_occupancy | integer | Default 0 | |
| is_active | boolean | Default true | |
| contact_number | text | No | |
| facilities | text[] | Default [] | Known: medical_desk, pet_friendly, generator |
| verified | boolean | Default false | |
| deleted_at | timestamptz | No | Soft delete |
| created_at, updated_at | timestamptz | Auto | |

RLS: Admins can `ALL` on centers in their barangay.

## Files to Create/Modify

### 1. Shared Schema (`packages/shared/src/schemas/evacuation-center.ts`)
- Zod schema for validation matching the database columns
- Export types for form values
- Known facility options as constant

### 2. Export from Shared (`packages/shared/src/index.ts`)
- Add export for the new schema

### 3. Create Form Component (`apps/web/src/app/(admin)/evacuation-centers/evacuation-center-form.tsx`)
- Client component ('use client')
- Fields: name, address, position (lat/lng inputs), capacity, current_occupancy, is_active, contact_number, facilities (checkboxes), verified
- Validation via shared schema
- Supabase insert on submit
- Toast notifications
- `router.refresh()` after success for real-time feel

### 4. Create Row Component (`apps/web/src/app/(admin)/evacuation-centers/evacuation-center-row.tsx`)
- Client component ('use client')
- Display: name, address, capacity/occupancy, facilities badges, verified badge, contact
- Edit mode inline form (pre-filled)
- Save updates via Supabase
- Archive (soft delete) via ConfirmButton → sets `deleted_at`
- Real-time subscription for auto-refresh on changes

### 4. Real-time Subscription Pattern
- Unique channel name per mount: `admin-evacuation-centers-${random}`
- Listen to `postgres_changes` on `evacuation_centers` with filter `barangay_id=eq.${barangayId}`
- On any change: `router.refresh()`

### 5. Update Page (`apps/web/src/app/(admin)/evacuation-centers/page.tsx`)
- Server component
- Fetch barangay_id from profile
- Fetch centers (including soft-deleted for admin view, ordered by name)
- Render: Title, description, Create form section, Published centers list
- Pass `barangayId` to form and rows

## Real-time Sync: Admin → Resident
- Resident mobile app uses `useEvacuationCenters` hook (no realtime currently)
- Admin changes trigger `router.refresh()` on admin side
- For resident real-time: mobile hook would need subscription (out of scope for this task, but admin screen will have it)
- The requirement "when admin updates the resident will see the update immediately" implies mobile hook should also subscribe — **clarification needed**: is mobile realtime in scope?

## Validation Commands
```bash
cd apps/web && npm run lint && npm run typecheck
cd packages/shared && npm run lint && npm run typecheck
```

## Open Questions
1. **Mobile real-time sync**: Should `useEvacuationCenters` hook add a Supabase realtime subscription so residents see updates without reload? (Currently it explicitly avoids realtime per comment)
2. **Facilities UX**: Checkbox group vs free-text array input?
3. **Position input**: Two number inputs (lat/lng) or single JSON textarea?
4. **Soft delete vs hard delete**: Announcements use "Archive" (soft delete). Same pattern for centers?

## Recommended Answers
1. **Mobile realtime**: Yes, add to mobile hook in a follow-up; admin screen gets realtime now.
2. **Facilities**: Checkbox group for known facilities + "Other" text input.
3. **Position**: Two number inputs with step=0.000001.
4. **Soft delete**: Yes, mirror announcements (set `deleted_at`).