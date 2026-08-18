import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Tables } from '@barangayan/shared';
import type { Polygon, MultiPolygon } from 'geojson';

import { IncidentMapClient } from './IncidentMapClient';

export type IncidentRow = Tables<'incidents'> & {
  incident_categories: Pick<Tables<'incident_categories'>, 'name' | 'color' | 'icon'> | null;
  profiles: Pick<Tables<'profiles'>, 'full_name' | 'email' | 'mobile_number' | 'home_address'> | null;
};

interface CategoryRow {
  id: string;
  name: string;
  color: string;
  icon: string | null;
}

interface EvacuationCenterRow {
  id: string;
  name: string;
  address: string | null;
  position: { lat: number; lng: number } | null;
  capacity: number | null;
  current_occupancy: number;
  facilities: string[];
  is_active: boolean;
}

export default async function IncidentMapPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; category?: string; q?: string }>;
}) {
  void searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('barangay_id').eq('id', user!.id).single();

  const { data: incidents } = await supabase
    .from('incidents')
    .select(
      '*, incident_categories(name, color, icon), profiles!incidents_reporter_id_fkey(full_name, email, mobile_number, home_address)',
    )
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
    .eq('id', profile?.barangay_id ?? '')
    .single();

  const incidentCount = incidents?.length ?? 0;
  const centerCount = centers?.length ?? 0;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <div className="flex items-center gap-3.5 mb-1.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] shadow-lg shadow-[var(--accent)]/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white"
            >
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-foreground">Incident Map</h1>
            <p className="text-sm text-muted-foreground">
              {incidentCount} {incidentCount === 1 ? 'incident' : 'incidents'} · {centerCount}{' '}
              {centerCount === 1 ? 'evacuation center' : 'evacuation centers'}
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground/80 ml-[58px]">
          Geographic view of reported incidents and evacuation centers in your barangay.
        </p>
      </div>

      <IncidentMapClient
        incidents={(incidents ?? []) as IncidentRow[]}
        categories={(categories ?? []) as CategoryRow[]}
        centers={(centers ?? []) as EvacuationCenterRow[]}
        boundary={(barangay?.boundary as Polygon | MultiPolygon | null) ?? null}
      />
    </div>
  );
}
