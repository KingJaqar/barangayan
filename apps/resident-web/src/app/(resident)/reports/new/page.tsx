import type { MultiPolygon, Polygon } from 'geojson';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/require-user';
import { withBoundaryFallback } from '@/lib/barangay-boundary';
import { NewReportForm } from './new-report-form';

export default async function NewReportPage() {
  const { profile } = await requireUser();

  const supabase = await createSupabaseServerClient();
  const [{ data: categories }, { data: zones }, { data: barangay }] = await Promise.all([
    supabase.from('incident_categories').select('id, name, color, is_trash_related, icon').order('name'),
    supabase.from('waste_zones').select('id, name').eq('barangay_id', profile.barangay_id).order('name'),
    supabase.from('barangays').select('boundary').eq('id', profile.barangay_id).single(),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <NewReportForm
        categories={categories ?? []}
        zones={zones ?? []}
        barangayId={profile.barangay_id}
        boundary={withBoundaryFallback((barangay?.boundary as Polygon | MultiPolygon | null) ?? null)}
      />
    </div>
  );
}
