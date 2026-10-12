import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadTable, parseTableState } from '@/lib/admin-tables/queries/browse';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StaffTable } from './staff-table';
export type { OfficialWithProfile } from './types';

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
  const results = await loadTable('staff', params, supabase);
  return <div className="mx-auto min-w-0 max-w-6xl">
    <AdminPageHeader title="Staff & Admin Accounts" description="Invite and manage barangay staff and administrator accounts." />
    <StaffTable result={results.table} summary={results.summary} requestedState={parseTableState('staff', params)}
      currentUserId={user.id} barangayId={profile.barangay_id} />
  </div>;
}
