import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface ResidentProfile {
  id: string;
  role: string;
  full_name: string;
  barangay_id: string;
  avatar_url: string | null;
  barangayName: string;
}

/**
 * The single, centralized route guard for every gated (resident)/* route — no page
 * should hand-roll its own auth.getUser() check (see the plan's Phase 0 design choice).
 *
 * - No session -> redirect to /login?next=<current path>, so login returns the resident
 *   to where they were headed.
 * - Session but no profile row -> redirect to /login (shouldn't happen; handle_new_user
 *   creates the profile atomically with the auth.users row).
 * - profiles.role === 'admin' -> bounce to admin-web's own /dashboard via an ABSOLUTE
 *   cross-origin URL. This is deliberately not a relative redirect() — the admin
 *   session belongs on the other app entirely (see Phase 9's mirror-image bounce on the
 *   admin-web side).
 *
 * requireUser()/getOptionalUser() are UX guards, not the real security boundary — RLS on
 * every table is (see the plan's §7 Security Verification Track). Never treat a
 * successful requireUser() call as proof a subsequent query is authorized; RLS still has
 * to allow it.
 */
export async function requireUser(): Promise<{ user: { id: string; email: string | undefined }; profile: ResidentProfile }> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const pathname = (await headers()).get('x-pathname') ?? '/home';
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, barangay_id, avatar_url, barangays(name)')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  if (profile.role === 'admin') {
    redirect(`${process.env.NEXT_PUBLIC_ADMIN_WEB_URL}/dashboard`);
  }

  return {
    user: { id: user.id, email: user.email },
    profile: {
      id: profile.id,
      role: profile.role,
      full_name: profile.full_name,
      barangay_id: profile.barangay_id,
      avatar_url: profile.avatar_url,
      barangayName: profile.barangays?.name ?? 'Barangay',
    },
  };
}
