import { redirect } from 'next/navigation';

import { ResidentShell } from '@/components/resident/resident-shell';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Guards every route under (resident) — the web counterpart of the mobile app's
 * (app) group. Same Supabase project/profiles.role column as (admin)/layout.tsx;
 * an admin session lands here on `/resident` and is bounced to `/dashboard`
 * instead, mirroring how (admin)/layout.tsx bounces residents to `/login`.
 *
 * This closes the audit report's PLAT-01 finding — until this route group
 * existed, every non-admin session hit (admin)/layout.tsx's guard and was sent
 * straight back to /login, so residents had no web surface at all.
 */
export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, barangay_id, avatar_url, barangays(name)')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  if (profile.role === 'admin') {
    redirect('/dashboard');
  }

  return (
    <ResidentShell
      barangayName={profile.barangays?.name ?? 'Barangay'}
      residentName={profile.full_name}
      avatarUrl={profile.avatar_url}
    >
      {children}
    </ResidentShell>
  );
}
