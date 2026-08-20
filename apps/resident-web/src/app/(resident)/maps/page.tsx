import type { CategoryRow, MapEvacuationMarker, MapIncidentMarker, Tables } from '@barangayan/shared';
import type { MultiPolygon, Polygon } from 'geojson';

import { MapClientWrapper } from '@/components/maps/map-client-wrapper';
import { MapSidebar } from '@/components/maps/map-sidebar';
import { getOptionalUser } from '@/lib/auth/get-optional-user';
import { withBoundaryFallback } from '@/lib/barangay-boundary';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type IncidentWithCategory = Tables<'incidents'> & {
  incident_categories: Pick<Tables<'incident_categories'>, 'name' | 'color'> | null;
};

/**
 * Maps, Directory & Guides — Phase 4. Guest-accessible (getOptionalUser(), not
 * requireUser()) like /home, /emergency and /emergency/centers: `incidents` has a
 * dedicated "guest read barangay incidents" anon policy (migration 0025, comment: "The
 * Maps tab is accessible in guest mode") and `evacuation_centers`/`barangays` are
 * unrestricted public reads (migrations 0055, 0001) — so there is nothing here an
 * unauthenticated visitor is blocked from seeing at the RLS layer either.
 *
 * Verified via the anon policy's own text: unlike every other guest-readable table in
 * this app, the anon `incidents` policy is `using (deleted_at is null)` with NO
 * barangay_id scoping (current_barangay_id() has nothing to resolve without a session
 * anyway) — so a guest visitor sees incident markers across every barangay, not just
 * one. That is existing, deployed backend behavior, not something introduced here.
 *
 * `incident_categories`, by contrast, has no anon policy at all (only "residents read
 * own barangay categories", `to authenticated`) and was not included in migration
 * 0055's guest-access grant — so for a guest the category join returns null and the
 * category list is empty. Handled gracefully below (MapFilterPills already renders
 * nothing when `categories` is empty), not treated as an error.
 */
export default async function MapsPage() {
  const { profile } = await getOptionalUser();
  const supabase = await createSupabaseServerClient();

  const [{ data: incidents }, { data: centers }, { data: categories }, { data: barangay }] = await Promise.all([
    supabase
      .from('incidents')
      .select('id, title, status, address, location, category_id, incident_categories(name, color)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('evacuation_centers').select('*').eq('is_active', true).is('deleted_at', null).order('name'),
    profile
      ? supabase.from('incident_categories').select('id, name, color, icon').order('name')
      : Promise.resolve({ data: [] as CategoryRow[] }),
    profile
      ? supabase.from('barangays').select('boundary').eq('id', profile.barangay_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const incidentMarkers: MapIncidentMarker[] = (incidents ?? [])
    .filter((inc): inc is IncidentWithCategory => {
      const loc = inc.location as { lat?: unknown; lng?: unknown } | null;
      return loc !== null && typeof loc === 'object' && typeof loc.lat === 'number' && typeof loc.lng === 'number';
    })
    .map((inc) => {
      const loc = inc.location as { lat: number; lng: number };
      return {
        id: inc.id,
        position: { lat: loc.lat, lng: loc.lng },
        kind: inc.category_id ?? 'incident',
        label: inc.title,
        status: inc.status,
        categoryColor: inc.incident_categories?.color,
        categoryName: inc.incident_categories?.name,
        address: inc.address,
      };
    });

  const evacuationMarkers: MapEvacuationMarker[] = (centers ?? [])
    .filter((c) => {
      const pos = c.position as { lat?: unknown; lng?: unknown } | null;
      return pos !== null && typeof pos === 'object' && typeof pos.lat === 'number' && typeof pos.lng === 'number';
    })
    .map((c) => {
      const pos = c.position as { lat: number; lng: number };
      return {
        id: c.id,
        position: { lat: pos.lat, lng: pos.lng },
        kind: 'evacuation' as const,
        label: c.name,
        capacity: c.capacity,
        currentOccupancy: c.current_occupancy,
      };
    });

  const boundary = withBoundaryFallback((barangay?.boundary as Polygon | MultiPolygon | null) ?? null);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">Maps</h1>
        <p className="text-xs text-muted-foreground">
          {incidentMarkers.length} {incidentMarkers.length === 1 ? 'incident' : 'incidents'} · {evacuationMarkers.length}{' '}
          {evacuationMarkers.length === 1 ? 'evacuation center' : 'evacuation centers'}
        </p>
      </div>

      {/* Map + sidebar side by side once there's room for both (per request: the
          Emergency/Report shortcuts move out from under the map into the unused space
          beside it); the sidebar naturally falls below the map on narrow viewports since
          it's a single-column grid there. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_300px]">
        <MapClientWrapper
          incidentMarkers={incidentMarkers}
          evacuationMarkers={evacuationMarkers}
          categories={(categories ?? []) as CategoryRow[]}
          boundary={boundary}
        />
        <MapSidebar />
      </div>
    </div>
  );
}
