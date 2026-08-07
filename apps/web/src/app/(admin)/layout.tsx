import { redirect } from 'next/navigation';

import { AdminShell } from '@/components/admin/admin-shell';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Guards every route under (admin) — same Supabase project, same profiles.role column
 * defined in the 0001 migration; there is no separate "admin app." Non-admin sessions
 * (including no session at all) are redirected to /login rather than shown a blank
 * dashboard shell.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, barangays(name)')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    redirect('/login');
  }

  return (
    <AdminShell barangayName={profile.barangays?.name ?? 'Barangay'} adminName={profile.full_name}>
      {children}
    </AdminShell>
  );
}
