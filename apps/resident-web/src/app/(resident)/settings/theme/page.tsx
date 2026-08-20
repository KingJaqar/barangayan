import { requireUser } from '@/lib/auth/require-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ThemeForm } from './theme-form';

export const metadata = { title: 'Theme & Appearance' };

export default async function ThemePage() {
  const { user } = await requireUser();

  // Fetch the resident's saved theme/accent/font preference from their profile so
  // ThemeForm can reconcile the DB value with the local localStorage pick on mount.
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('theme_preference, accent_color, font_preference')
    .eq('id', user.id)
    .single();

  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight">Theme & Appearance</h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          Choose your preferred color scheme, accent color, and font. Changes apply instantly across the app.
        </p>
      </div>
      <ThemeForm
        userId={user.id}
        savedTheme={(profile?.theme_preference as 'light' | 'dark' | null) ?? null}
        savedAccent={(profile?.accent_color as string | null) ?? null}
        savedFont={(profile?.font_preference as string | null) ?? null}
      />
    </div>
  );
}
