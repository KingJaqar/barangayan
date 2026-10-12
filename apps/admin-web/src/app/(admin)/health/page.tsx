import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadTable, parseTableState } from '@/lib/admin-tables/queries/browse';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DriveTable } from './drive-table';
export type { DriveRow } from './types';

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
  const results = await loadTable('health', params, supabase);
  return <div className="mx-auto min-w-0 max-w-6xl">
    <AdminPageHeader title="Health" description="Manage vaccination, medical, and wellness drives for the barangay." />
    <DriveTable result={results.table} summary={results.summary} requestedState={parseTableState('health', params)}
      barangayId={profile.barangay_id} />
  </div>;
}
