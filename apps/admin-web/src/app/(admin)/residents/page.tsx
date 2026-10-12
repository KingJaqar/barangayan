import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadTable, parseTableState } from '@/lib/admin-tables/queries/browse';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ResidentDirectory } from './resident-directory';
export type { ResidentRow } from './types';

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
  const results = await loadTable('residents', params, supabase);
  return <div className="mx-auto min-w-0 max-w-6xl">
    <AdminPageHeader title="Resident Directory" description="Registered residents in your barangay — CRUD, ID verification, and household info." />
    <ResidentDirectory result={results.table} summary={results.summary} requestedState={parseTableState('residents', params)}
      barangayId={profile.barangay_id} />
  </div>;
}
