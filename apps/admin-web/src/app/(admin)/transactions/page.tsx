import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadTable, parseTableState } from '@/lib/admin-tables/queries/browse';
import { pilotOptions } from '@/lib/admin-tables/queries/pilot-options';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { TransactionsTable } from './transactions-table';

export default async function TransactionsPage({ searchParams }: {
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
  const [results, references, admins, residents, documents] = await Promise.all([
    loadTable('transactions', params, supabase),
    supabase.from('service_requests').select('reference_number').eq('barangay_id', profile.barangay_id)
      .is('deleted_at', null).order('created_at', { ascending: false }).limit(100).retry(false).abortSignal(AbortSignal.timeout(15000)),
    pilotOptions(supabase, 'profiles', profile.barangay_id, 'admin'),
    pilotOptions(supabase, 'profiles', profile.barangay_id, 'resident'),
    pilotOptions(supabase, 'document_types', profile.barangay_id),
  ]);
  const optionsError = [admins, residents, documents].find(outcome => outcome.status === 'error');
  return <div className="mx-auto min-w-0 max-w-6xl">
    <AdminPageHeader title="Financial Transactions" description="Pickup collections and QR PH receipts." />
    <TransactionsTable result={results.table} summary={results.summary} requestedState={parseTableState('transactions', params)}
      barangayId={profile.barangay_id} referenceOptions={(references.data ?? []).map(row => row.reference_number)}
      admins={admins.status === 'success' ? admins.value : []} residents={residents.status === 'success' ? residents.value : []}
      documentTypes={documents.status === 'success' ? documents.value : []}
      optionsError={optionsError?.status === 'error' ? optionsError.message : references.error ? 'Could not load request suggestions. Retry options.' : null} />
  </div>;
}
