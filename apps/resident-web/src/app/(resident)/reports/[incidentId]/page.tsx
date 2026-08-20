import { notFound } from 'next/navigation';

import { requireUser } from '@/lib/auth/require-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { IncidentDetail } from './incident-detail';

interface PageProps {
  params: Promise<{ incidentId: string }>;
}

export default async function IncidentDetailPage({ params }: PageProps) {
  const { incidentId } = await params;
  const { profile } = await requireUser();

  const supabase = await createSupabaseServerClient();
  const { data: incident } = await supabase
    .from('incidents')
    .select(`
      id, title, description, status, photo_urls, created_at, updated_at, confirmation_count,
      resolved_read_at, address, specific_area_details, location, deleted_at,
      incident_categories(id, name, color, icon)
    `)
    .eq('id', incidentId)
    .eq('reporter_id', profile.id)
    .is('deleted_at', null)
    .single();

  // Not found OR belongs to a different resident → 404 (no information leakage).
  if (!incident) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <IncidentDetail incident={incident as Parameters<typeof IncidentDetail>[0]['incident']} />
    </div>
  );
}
