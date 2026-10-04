import { ensureGoogleResidentProfile, needsResidentProfile, residentCompletionDestination } from '@barangayan/shared';
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
 * - Missing or incomplete resident profile -> mandatory /complete-profile.
 * - Any authenticated role with a profile stays in resident-web.
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

  await ensureGoogleResidentProfile(supabase, user);
  if (await needsResidentProfile(supabase, user.id)) redirect(residentCompletionDestination((await headers()).get('x-pathname')));

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, barangay_id, avatar_url, barangays(name)')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  const { data: locality } = await supabase.from('barangay_localities')
    .select('display_name').eq('barangay_id', profile.barangay_id).maybeSingle();

  return {
    user: { id: user.id, email: user.email },
    profile: {
      id: profile.id,
      role: profile.role,
      full_name: profile.full_name,
      barangay_id: profile.barangay_id,
      avatar_url: profile.avatar_url,
      barangayName: locality?.display_name ?? profile.barangays?.name ?? 'Barangay',
    },
  };
}
