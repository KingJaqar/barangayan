# Emergency & DRRM Info — Hub Segment Implementation Plan

## Goal
Replace the `PlaceholderPanel` stubs in `home/emergency-info` with a pixel-accurate implementation of the Hub tab (and minimal real content for Centers/Family/Alerts) backed by Supabase tables for Disaster Preparedness Guidelines and Emergency Hotlines.

## Current State
- `apps/mobile/src/app/(app)/home/emergency-info/index.tsx` exists with 5 sub-nav tabs but Hub/Centers/Family/Alerts are all `PlaceholderPanel`.
- `emergency-info/_layout.tsx` wraps `index` and `qr-guide` in a Stack.
- No database tables exist for emergency guidelines or hotlines.
- Theme system, `@expo/vector-icons` (Ionicons), `ThemedText`/`ThemedView`, `StyleSheet.create` are already established.

---

## 1. Database Schema — New Migration `0043_emergency_content.sql`

**Table: `emergency_guidelines`**
- `id` uuid PK
- `barangay_id` uuid FK → barangays(id)
- `category` text NOT NULL — e.g. `typhoon`, `earthquake`, `fire`, `flood`
- `title` text NOT NULL — display name
- `icon` text — Ionicons name (e.g. `water-outline`, `warning-outline`, `flame-outline`, `home-outline`)
- `icon_color` text — hex accent for the icon row
- `icon_bg` text — hex background for the icon circle
- `content` jsonb — array of guideline steps/paragraphs
- `sort_order` integer NOT NULL DEFAULT 0
- `is_active` boolean NOT NULL DEFAULT true
- `deleted_at` timestamptz
- `created_at` timestamptz DEFAULT now()
- `updated_at` timestamptz DEFAULT now()

RLS:
- Public read (residents + guests) for active, non-deleted rows.
- Admin full management scoped to their barangay.

**Table: `emergency_hotlines`**
- `id` uuid PK
- `barangay_id` uuid FK → barangays(id)
- `name` text NOT NULL
- `numbers` jsonb — array of `{ label: string, number: string }` (e.g. `[{label:"117", number:"117"}, {label:"(02) 8123-4567", number:"021234567"}]`)
- `icon` text — Ionicons name
- `icon_color` text
- `icon_bg` text
- `sort_order` integer NOT NULL DEFAULT 0
- `is_active` boolean NOT NULL DEFAULT true
- `deleted_at` timestamptz
- `created_at` timestamptz DEFAULT now()
- `updated_at` timestamptz DEFAULT now()

RLS:
- Public read (residents + guests) for active, non-deleted rows.
- Admin full management scoped to their barangay.

**Update `packages/shared/src/types/database.ts`** to add the two new tables (Row/Insert/Update types).

---

## 2. Seed Data — Update `supabase/seed.sql`

Insert 4 active `emergency_guidelines` rows for `Barangay Ampid I`:
1. Typhoon — icon: `water-outline`, color: `#0F6E5B`, bg: `#E6F2EF`
2. Earthquake — icon: `warning-outline`, color: `#D97706`, bg: `#FEF3C7`
3. Fire — icon: `flame-outline`, color: `#DC2626`, bg: `#FEE2E2`
4. Flood — icon: `home-outline`, color: `#0F6E5B`, bg: `#E6F2EF`

Insert 5 active `emergency_hotlines` rows:
1. Police — `117 / (02) 8123-4567`
2. Fire Department — `911 / (02) 8765-4321`
3. Ambulance — `143 / (02) 8999-8888`
4. Barangay DRRM Office — `0917 123 4567`
5. General Hospital — `(02) 8234-5678`

---

## 3. Mobile Hooks

**`apps/mobile/src/hooks/use-emergency-guidelines.ts`**
- Fetches active `emergency_guidelines` for the resident's barangay.
- Returns `{ guidelines, isLoading, error, refetch }`.

**`apps/mobile/src/hooks/use-emergency-hotlines.ts`**
- Fetches active `emergency_hotlines` for the resident's barangay.
- Returns `{ hotlines, isLoading, error, refetch }`.

Both hooks use the existing `useProfile` to get `barangayId`, then query Supabase with the same patterns used by `use-evacuation-centers.ts` and `use-incidents.ts`.

---

## 4. New Components

**`apps/mobile/src/components/emergency-accordion.tsx`**
- Props: `items: { title: string; icon: IoniconsName; iconColor: string; iconBg: string; content: string[] }[]`
- Each item renders:
  - Row with icon circle + title + chevron (`chevron-down`)
  - Expanded content area showing guideline steps
- Animated height via `Animated` + `LayoutAnimation` (or simple conditional render with rotation).
- Matches the card styling: white background, border, rounded corners, dividers between items.

**`apps/mobile/src/components/hotline-row.tsx`**
- Props: `name: string`, `numbers: { label: string; number: string }[]`, `icon: IoniconsName`, `iconColor: string`, `iconBg: string`
- Renders: icon circle + name + primary number (regular weight) + yellow/orange circular call button (`call-outline` icon)
- `onPress` on call button → `Linking.openURL(`tel:${number}`)` (needs `expo-linking` or `Linking` from react-native).
- Row has bottom border except the last item.

---

## 5. Screen Update — `home/emergency-info/index.tsx`

**Visual audit from image:**
- Header: dark green (`#0F6E5B`) full-width, back chevron left, title centered.
- Sub-nav: 5 tabs (Hub, Centers, Scan, Family, Alerts) — underline indicator, active tab is bold + primary color.
- **Hub tab content** (ScrollView required — currently missing):
  - Section title "Emergency Info" (large, bold, primary color) + subtitle "Be Prepared" (muted)
  - Card 1: **Disaster Preparedness Guidelines**
    - Header row: section title + `Offline` badge (light gray pill with wifi-off icon, dark border, small bold text)
    - 4 accordion items (Typhoon, Earthquake, Fire, Flood)
  - Card 2: **Emergency Hotlines**
    - Header row: section title + `Offline` badge
    - 5 hotline rows with call buttons
  - Both cards: white background, rounded-2xl border, padding ~16-20px, gap between cards.
- **Centers tab**: Replace placeholder with real evacuation centers list (reuse `useEvacuationCenters`).
- **Family tab**: Keep placeholder or show household members from `useProfile`.
- **Alerts tab**: Keep placeholder for now (out of scope for this image, but wire it up minimally).
- **Scan tab**: Already pushes `qr-guide` (keep as-is).

**Implementation notes:**
- Wrap tab content in `ScrollView` so long lists don't overflow.
- Use `ThemedView type="background"` as the outer scroll container.
- Use exact spacing tokens from `Spacing` (three: 16, four: 24, two: 8, etc.).
- "Offline" badge: `View` with `borderWidth: 1`, `borderRadius: 8`, `paddingHorizontal: 7`, `paddingVertical: 2`, `flexDirection: 'row'`, `alignItems: 'center'`, `gap: 4`. Text: `fontSize: 10`, `fontWeight: '600'`, `color: theme.textSecondary`.
- Call button: `View` with `width: 40`, `height: 40`, `borderRadius: 20`, `backgroundColor: '#F59E0B'` (or similar yellow), centered `call-outline` icon `#FFFFFF`.

---

## 6. QR Guide — `qr-guide.tsx`

Keep as simple placeholder (out of scope for this image). The image only shows the Hub segment.

---

## 7. Validation

- `npm run lint` (mobile)
- `npm run typecheck` (if script exists)
- Verify Supabase migration applies cleanly
- Verify seed data populates correctly

---

## Files Changed / Created

| Action | Path |
|--------|------|
| Create | `supabase/migrations/0043_emergency_content.sql` |
| Edit | `supabase/seed.sql` |
| Edit | `packages/shared/src/types/database.ts` |
| Create | `apps/mobile/src/hooks/use-emergency-guidelines.ts` |
| Create | `apps/mobile/src/hooks/use-emergency-hotlines.ts` |
| Create | `apps/mobile/src/components/emergency-accordion.tsx` |
| Create | `apps/mobile/src/components/hotline-row.tsx` |
| Edit | `apps/mobile/src/app/(app)/home/emergency-info/index.tsx` |

---

## Risks / Open Questions

1. **Icons for Typhoon/Earthquake**: Ionicons does not have dedicated typhoon or earthquake icons. The image appears to use custom or alternative icons. I'll use `water-outline` for Typhoon and `warning-outline` for Earthquake as the closest matches.
2. **Offline badge behavior**: Static design element in the screenshot. No dynamic connectivity check is required for v1 — the badge is always shown.
3. **Call button color**: The screenshot shows a golden/yellow call button. I'll use `#F59E0B` (Amber-500) as the closest standard utility color.
