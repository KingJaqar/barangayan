import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadTable, parseTableState } from '@/lib/admin-tables/queries/browse';
import { pilotOptions } from '@/lib/admin-tables/queries/pilot-options';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { HouseholdsTable } from './households-table';
export type { HouseholdMemberRow } from './types';

export default async function Page({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams(Object.entries(await searchParams)
    .flatMap(([key, value]) => value === undefined ? [] : [[key, Array.isArray(value) ? value[0] : value]]));
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('barangay_id,role')
    .eq('id', user.id).is('deleted_at', null).single();
  if (!profile || profile.role !== 'admin') redirect('/login');
  const [results, options] = await Promise.all([loadTable('households', params, supabase),
    pilotOptions(supabase, 'profiles', profile.barangay_id, 'resident')]);
  return <div className="mx-auto min-w-0 max-w-6xl">
    <AdminPageHeader title="Households & Residents" description="Manage household members and confirm evacuation arrivals and departures." />
    <HouseholdsTable result={results.table} summary={results.summary} requestedState={parseTableState('households', params)}
      actorId={user.id} barangayId={profile.barangay_id}
      residents={options.status === 'success' ? options.value : []} optionsError={options.status === 'error' ? options.message : null} />
  </div>;
}
