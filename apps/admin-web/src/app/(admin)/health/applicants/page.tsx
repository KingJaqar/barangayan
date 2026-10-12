import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadTable, parseTableState } from '@/lib/admin-tables/queries/browse';
import { pilotOptions } from '@/lib/admin-tables/queries/pilot-options';
import { operationsOptions } from '@/lib/admin-tables/queries/operations-options';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ApplicantsTable } from './applicants-table';
export type { ApplicantRow } from './types';

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
  const [results, options, residents] = await Promise.all([loadTable('applicants', params, supabase),
    operationsOptions(supabase, 'medical_drives', profile.barangay_id),
    pilotOptions(supabase, 'profiles', profile.barangay_id, 'resident')]);
  return <div className="mx-auto min-w-0 max-w-6xl">
    <AdminPageHeader title="Medical Applicants" description="Review and manage resident registrations for medical drives." />
    <ApplicantsTable result={results.table} summary={results.summary} requestedState={parseTableState('applicants', params)}
      barangayId={profile.barangay_id}
      drives={options.status === 'success' ? options.value : []}
      residents={residents.status === 'success' ? residents.value : []}
      optionsError={options.status === 'error' ? options.message : residents.status === 'error' ? residents.message : null} />
  </div>;
}
