import type { Tables } from '@barangayan/shared';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadTable, parseTableState } from '@/lib/admin-tables/queries/browse';
import { pilotOptions } from '@/lib/admin-tables/queries/pilot-options';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { RequestsTable } from './requests-table';

export type ServiceRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name'> | null;
  profiles: Pick<Tables<'profiles'>, 'full_name'> | null;
};

export default async function RequestsPage({ searchParams }: {
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
  const [results, residents, documents] = await Promise.all([
    loadTable('requests', params, supabase),
    pilotOptions(supabase, 'profiles', profile.barangay_id, 'resident'),
    pilotOptions(supabase, 'document_types', profile.barangay_id, undefined, true),
  ]);
  return <div className="mx-auto min-w-0 max-w-6xl">
    <AdminPageHeader title="Requests" description="Work document requests through their lifecycle." />
    <RequestsTable result={results.table} summary={results.summary} requestedState={parseTableState('requests', params)}
      residents={residents.status === 'success' ? residents.value : []}
      documentTypes={documents.status === 'success' ? documents.value : []}
      optionsError={residents.status === 'error' ? residents.message : documents.status === 'error' ? documents.message : null}
      barangayId={profile.barangay_id} />
  </div>;
}
