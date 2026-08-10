# Incident Map Admin Screen - Implementation Plan

## Overview
Transform the non-functional `apps/web/src/app/(admin)/incident-map/page.tsx` placeholder into a fully production-ready, interactive geographic map screen showing community-reported incidents and evacuation centers, mirroring the mobile Maps screen's functionality but adapted for web admin use.

---

## 1. Tech Stack & Architecture Decisions

| Layer | Technology | Notes |
|-------|------------|-------|
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS | Server Components for data fetching, Client Components for interactivity |
| **Map** | `react-leaflet` + `leaflet` | Native web map (not WebView) — install `leaflet` and `react-leaflet` |
| **Backend/DB** | Supabase Postgres with RLS | Existing `incidents`, `incident_categories`, `evacuation_centers`, `barangays` tables |
| **Auth** | `@supabase/ssr` (server + browser clients) | Admin-only routes guarded by layout |
| **Types/Validation** | `@barangayan/shared` (Zod schemas, DB types) | Shared package for type safety |
| **State/Data** | Server Components + `useState`/`useEffect` in Client Components | No React Query — follows existing admin pattern |

---

## 2. Database & Security (Already Exists — No Migrations Needed)

### Tables (from `0022_maps_tables.sql` + `0025_incident_management.sql`)
- `incidents` — geo-tagged reports with `location` (JSONB: `{lat, lng}`), `category_id`, `status`, `photo_urls`, `confirmation_count`
- `incident_categories` — barangay-scoped catalog with `color`, `icon`, `is_trash_related`
- `evacuation_centers` — shelter locations with `position` (JSONB: `{lat, lng}`), `capacity`, `current_occupancy`
- `barangays` — includes `boundary` (GeoJSON Polygon/MultiPolygon)

### RLS Policies
- Admins read/write incidents/centers in their barangay (`current_role() = 'admin'`)
- Residents read own-barangay incidents/centers
- Guest (anon) reads non-deleted incidents + active evacuation centers (for mobile map)
- Storage bucket `incident-photos` — public read, resident write to own folder

### RPCs (Available)
- `confirm_incident(p_incident_id)` — resident upvote
- `update_incident_status(p_incident_id, p_status)` — admin FSM: open → in_progress → resolved
- `soft_delete_incident(p_incident_id)` — admin soft-delete / resident withdraw (24h window)

---

## 3. Shared Schemas & Types (Add to `packages/shared`)

### File: `packages/shared/src/schemas/incident-map.ts` (NEW)
```typescript
import { z } from 'zod';
import type { LatLng } from '../types/map-bridge';

export const incidentMapFiltersSchema = z.object({
  tab: z.enum(['incidents', 'evacuation']).default('incidents'),
  categoryIds: z.array(z.string().uuid()).optional(),
  searchQuery: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'resolved']).optional(),
});

export type IncidentMapFilters = z.infer<typeof incidentMapFiltersSchema>;

export interface MapIncidentMarker {
  id: string;
  position: LatLng;
  kind: string; // category_id or 'incident'
  label: string;
  status: string;
  categoryColor?: string;
  categoryName?: string;
}

export interface MapEvacuationMarker {
  id: string;
  position: LatLng;
  kind: 'evacuation';
  label: string;
  capacity?: number | null;
  currentOccupancy?: number;
}
```

### Update: `packages/shared/src/index.ts`
- Export new schemas/types

---

## 4. Data Fetching — Server Component (Page)

### File: `apps/web/src/app/(admin)/incident-map/page.tsx` (REPLACE)

**Responsibilities:**
1. Auth + profile lookup (barangay_id)
2. Fetch all data in parallel:
   - Incidents (with category + reporter profile)
   - Incident categories
   - Evacuation centers
   - Barangay boundary (GeoJSON)
3. Transform to marker arrays for client component
4. Pass data + searchParams to client component

**Query Structure:**
```typescript
const { data: incidents } = await supabase
  .from('incidents')
  .select('*, incident_categories(name, color, icon), profiles!incidents_reporter_id_fkey(full_name, mobile_number, home_address)')
  .is('deleted_at', null)
  .order('created_at', { ascending: false });

const { data: categories } = await supabase
  .from('incident_categories')
  .select('id, name, color, icon')
  .order('name');

const { data: centers } = await supabase
  .from('evacuation_centers')
  .select('*')
  .eq('is_active', true)
  .is('deleted_at', null)
  .order('name');

const { data: barangay } = await supabase
  .from('barangays')
  .select('boundary')
  .eq('id', profile.barangay_id)
  .single();
```

**Filtering:** Server-side where possible (category, status), client-side for search (title/description/category/reporter name) — mirrors `incident-reports/page.tsx`.

---

## 5. Client Component — Interactive Map

### File: `apps/web/src/app/(admin)/incident-map/IncidentMapClient.tsx` (NEW)

**Props:**
```typescript
interface IncidentMapClientProps {
  incidents: IncidentRow[]; // from page.tsx type
  categories: CategoryRow[];
  centers: EvacuationCenterRow[];
  boundary: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  initialTab: 'incidents' | 'evacuation';
  initialCategoryIds: string[];
  initialSearchQuery: string;
}
```

**State:**
- `activeTab`: 'incidents' | 'evacuation'
- `activeFilters`: string[] (category IDs)
- `searchQuery`: string
- `mapRef`: Leaflet map reference
- `markersLayer`: Layer group for markers
- `boundaryLayer`: Layer group for boundary
- `selectedMarker`: for popup detail

**Features:**
1. **Leaflet Map** (react-leaflet):
   - OSM tile layer
   - Fit to boundary on mount, else default to barangay center
   - Zoom control top-left

2. **Incident Markers**:
   - Color-coded by category (category.color)
   - Icon: category.icon or default
   - Popup: title, category pill, status pill, confirmation count, "View Details" link → `/incident-reports?tab=...&q=...` (or modal)
   - Cluster if >50 markers (optional: `leaflet.markercluster`)

3. **Evacuation Center Markers**:
   - Green icon, label = center name
   - Popup: name, address, capacity/occupancy, facilities badges

4. **Boundary Overlay**:
   - Red outline, semi-transparent fill
   - Fits map on load

5. **Floating Controls** (absolute positioning over map):
   - Search bar (top) — debounced, filters incident titles
   - Segment toggle (Incidents / Evacuation)
   - Filter pills (horizontal scroll) — category colors, multi-select
   - "Reset View" button (fit to boundary)

6. **Loading/Error/Empty States**:
   - Skeleton pills while categories load
   - Error banner with retry
   - Empty state illustration per tab

7. **URL Sync** (Next.js `useSearchParams` + `useRouter`):
   - `?tab=incidents&category=uuid1,uuid2&q=search`
   - Shareable, browser history

---

## 6. UI Components (Reuse/Adapt Existing)

### Reuse:
- `IncidentStatusPill` from `incident-reports/incident-table.tsx`
- `ConfirmButton`, `useToast`, `EditableDataTable` patterns
- Admin shell layout (already via layout.tsx)

### New Small Components:
- `MapSearchBar` — floating search input
- `MapSegmentToggle` — Incidents/Evacuation pills
- `MapFilterPills` — horizontal category filters
- `MapMarkerPopup` — custom popup content for incidents/centers
- `BoundaryFitButton` — "Reset View" FAB

---

## 7. Leaflet Setup for Next.js 16

### Installation:
```bash
npm install leaflet react-leaflet @types/leaflet
```

### CSS Import:
In `apps/web/src/app/globals.css` (or layout):
```css
@import 'leaflet/dist/leaflet.css';
```

### SSR Handling:
Leaflet is client-only. Use dynamic import with `ssr: false`:
```typescript
const MapComponent = dynamic(() => import('./IncidentMapClient'), { ssr: false });
```

### Marker Icons:
- Use `L.divIcon` with SVG strings (like mobile) to avoid image asset issues
- Category color → pin SVG fill
- Evacuation → green pin
- User location (optional) → red person pin

---

## 8. File Structure After Implementation

```
apps/web/src/app/(admin)/incident-map/
├── page.tsx                    # Server component — data fetching + passes to client
├── IncidentMapClient.tsx       # Client component — Leaflet map + interactions
├── MapSearchBar.tsx            # Floating search input
├── MapSegmentToggle.tsx        # Incidents / Evacuation toggle
├── MapFilterPills.tsx          # Category filter pills
├── MapMarkerPopup.tsx          # Popup content components
├── BoundaryFitButton.tsx       # Reset view FAB
└── types.ts                    # Local type aliases (optional)

packages/shared/src/schemas/
├── incident-map.ts             # NEW — Zod schemas for filters, marker types
└── index.ts                    # Updated exports
```

---

## 9. Implementation Task List (Ordered)

| # | Task | File(s) | Notes |
|---|------|---------|-------|
| 1 | Install leaflet dependencies | `apps/web/package.json` | `npm install leaflet react-leaflet @types/leaflet` |
| 2 | Add leaflet CSS import | `apps/web/src/app/globals.css` | `@import 'leaflet/dist/leaflet.css';` |
| 3 | Create shared schemas | `packages/shared/src/schemas/incident-map.ts` | Zod filters, marker interfaces |
| 4 | Update shared exports | `packages/shared/src/index.ts` | Export new types |
| 5 | Create client map component | `apps/web/src/app/(admin)/incident-map/IncidentMapClient.tsx` | Core Leaflet map with all features |
| 6 | Create floating UI components | `MapSearchBar.tsx`, `MapSegmentToggle.tsx`, `MapFilterPills.tsx`, `MapMarkerPopup.tsx`, `BoundaryFitButton.tsx` | Reusable, styled with Tailwind |
| 7 | Replace page.tsx | `apps/web/src/app/(admin)/incident-map/page.tsx` | Server component with parallel data fetching |
| 8 | Add dynamic import wrapper | `page.tsx` | `dynamic(() => import('./IncidentMapClient'), { ssr: false })` |
| 9 | Type-check & lint | `npm run typecheck && npm run lint` | Must pass |
| 10 | Test in browser | Manual verification | Check all tabs, filters, search, popups, boundary |

---

## 10. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| No barangay boundary | Fit to incident/center markers; fallback to default center (Ampid I) |
| Malformed location JSON | Skip marker, log warning (guard in marker derivation) |
| No incidents/centers | Show empty state illustration per tab |
| Network error on load | Error banner with "Retry" button (re-fetches via `router.refresh()`) |
| Category deleted but incident references it | Show "Unknown Category" with gray pill |
| 100+ markers | Add `leaflet.markercluster` (future enhancement) |
| Mobile viewport | Responsive floating controls (stack on small screens) |

---

## 11. Validation Criteria

1. **Page loads** at `/incident-map` for authenticated admin
2. **Map renders** with OSM tiles, no console errors
3. **Incident markers** appear, color-coded by category, clickable popups
4. **Evacuation markers** appear on "Evacuation" tab, green pins
5. **Boundary** drawn as red outline, map fits to it on load
6. **Search** filters incident titles in real-time (debounced)
7. **Category pills** multi-select, update markers instantly
8. **Tab switch** toggles between incident/evacuation layers
9. **URL updates** on every filter change, shareable
10. **Loading skeletons** shown while categories fetch
11. **Error banner** appears on fetch failure with retry
12. **Empty states** render when no data
13. **TypeScript strict mode** passes (`npm run typecheck`)
14. **ESLint** passes (`npm run lint`)

---

## 12. Out of Scope (Future Enhancements)

- Marker clustering (`leaflet.markercluster`)
- Route drawing (evacuation routing)
- Real-time marker updates via Supabase Realtime (currently page refresh only)
- Export map as image/PDF
- Admin CRUD for incidents/centers directly on map (use existing `/incident-reports` and `/evacuation-centers` pages)
- Offline map tiles (PWA)

---

## 13. Dependencies on Other Work

- None — all database tables, RLS, RPCs, and shared types already exist
- Mobile map bridge types (`map-bridge.ts`) reused for `LatLng` interface
- Existing admin components (toast, confirm, pills) reused

---

## 14. Rollout / Migration Path

1. Feature branch → PR → review
2. Deploy to staging → manual QA per validation criteria
3. Merge to main → auto-deploy to production
4. No database migration needed
5. No breaking changes to mobile app

---

*Plan created: 2026-08-10*
*Target: Production-ready admin incident map screen*