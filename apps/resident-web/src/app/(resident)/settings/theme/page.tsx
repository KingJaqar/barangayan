import { getOptionalUser } from '@/lib/auth/get-optional-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ThemeForm } from './theme-form';

export const metadata = { title: 'Theme & Appearance' };

/**
 * Guest-accessible (getOptionalUser(), not requireUser()) — theme/accent/font are
 * localStorage-backed (see the theme/accent/font controllers), so a guest can pick and
 * preview all three with zero account needed. Only the DB round-trip (cross-device
 * sync) is resident-only; ThemeForm skips that call entirely when userId is null.
 */
export default async function ThemePage() {
  const { user } = await getOptionalUser();

  // Fetch the resident's saved theme/accent/font preference from their profile so
  // ThemeForm can reconcile the DB value with the local localStorage pick on mount.
  // Guests have no profile row to fetch — ThemeForm's reconcile effect just no-ops.
  let savedTheme: 'light' | 'dark' | null = null;
  let savedAccent: string | null = null;
  let savedFont: string | null = null;
  if (user) {
    const supabase = await createSupabaseServerClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('theme_preference, accent_color, font_preference')
      .eq('id', user.id)
      .single();
    savedTheme = (profile?.theme_preference as 'light' | 'dark' | null) ?? null;
    savedAccent = (profile?.accent_color as string | null) ?? null;
    savedFont = (profile?.font_preference as string | null) ?? null;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight">Theme & Appearance</h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          {user
            ? 'Choose your preferred color scheme, accent color, and font. Changes apply instantly across the app.'
            : 'Choose your preferred color scheme, accent color, and font. Changes apply instantly on this device — log in to sync them across devices.'}
        </p>
      </div>
      <ThemeForm userId={user?.id ?? null} savedTheme={savedTheme} savedAccent={savedAccent} savedFont={savedFont} />
    </div>
  );
}
