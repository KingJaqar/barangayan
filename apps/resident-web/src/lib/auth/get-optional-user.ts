import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ResidentProfile } from '@/lib/auth/require-user';

/**
 * The guest-friendly counterpart of requireUser() — used by routes that must render for
 * both signed-out visitors and residents (currently just /home, per the plan's Route
 * Contract Matrix — a requireUser() mistake there would break guest browsing entirely).
 *
 * Still bounces an admin session to admin-web's /dashboard — an admin should never see
 * the resident home shell, guest or not.
 */
export async function getOptionalUser(): Promise<
  { user: { id: string; email: string | undefined }; profile: ResidentProfile } | { user: null; profile: null }
> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, barangay_id, avatar_url, barangays(name)')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return { user: null, profile: null };
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
