import { redirect } from 'next/navigation';

import { AdminShell } from '@/components/admin/admin-shell';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ownedAvatarPath } from '@/lib/admin-profile/schema';

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
    .select('role, full_name, avatar_url, barangay_id, barangays(name)')
    .eq('id', user.id)
    .is('deleted_at', null)
    .single();

  if (!profile || profile.role !== 'admin') {
    redirect('/login');
  }

  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const avatarUrl = apiUrl && ownedAvatarPath(profile.avatar_url, user.id, apiUrl) ? profile.avatar_url : null;

  return (
    <AdminShell
      barangayName={profile.barangays?.name ?? 'Barangay'}
      adminName={profile.full_name}
      adminAvatarUrl={avatarUrl}
      barangayId={profile.barangay_id}
    >
      {children}
    </AdminShell>
  );
}
