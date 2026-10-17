import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Tables } from '@barangayan/shared';
import type { Polygon, MultiPolygon } from 'geojson';

import { IncidentMapClient } from './IncidentMapClient';
import { IncidentMapHeader } from './IncidentMapHeader';
import styles from './incident-map.module.css';

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
    <div className={styles.page}>
      <IncidentMapHeader incidentCount={incidentCount} centerCount={centerCount} />

      <IncidentMapClient
        incidents={(incidents ?? []) as IncidentRow[]}
        categories={(categories ?? []) as CategoryRow[]}
        centers={(centers ?? []) as EvacuationCenterRow[]}
        boundary={(barangay?.boundary as Polygon | MultiPolygon | null) ?? null}
      />
    </div>
  );
}
