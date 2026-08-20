import type { MultiPolygon, Polygon } from 'geojson';

import { CentersContent } from '@/components/emergency/centers-content';
import { getOptionalUser } from '@/lib/auth/get-optional-user';
import { withBoundaryFallback } from '@/lib/barangay-boundary';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Evacuation Centers — list/map toggle, nearest-first sort, real OSRM walking route
 * [C-010]. Guest-accessible (see emergency/page.tsx's doc comment for the rationale) —
 * `evacuation_centers`' own RLS policy (migration 0022) has no `to authenticated` clause
 * at all, so this was already public-readable at the database layer.
 *
 * The barangay boundary line (fetched here, same as maps/page.tsx) now draws on this
 * map too, per request — falls back to the bundled Ampid I geometry when the DB column
 * is null (guest session, or not yet populated for this environment).
 */
export default async function EmergencyCentersPage() {
  const { profile } = await getOptionalUser();

  let dbBoundary: Polygon | MultiPolygon | null = null;
  if (profile) {
    const supabase = await createSupabaseServerClient();
    const { data: barangay } = await supabase.from('barangays').select('boundary').eq('id', profile.barangay_id).single();
    dbBoundary = (barangay?.boundary as Polygon | MultiPolygon | null) ?? null;
  }

  return <CentersContent barangayId={profile?.barangay_id ?? null} boundary={withBoundaryFallback(dbBoundary)} />;
}
