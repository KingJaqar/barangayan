import { DEFAULT_FONT_ID } from '@barangayan/shared';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { ThemeForm } from './theme-form';

// The admin's personal appearance control — writes the same profiles.theme_preference /
// accent_color columns the mobile Settings screen already reads/writes (0006 migration),
// plus the web-only custom_accent_colors / font_preference columns (0075 migration).
// Deliberately not a barangay-wide branding tool (see the plan's §1.2 scope note).
export default async function ThemePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('theme_preference, accent_color, custom_accent_colors, font_preference')
    .eq('id', user!.id)
    .single();

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Theme</h1>
        <p className="text-sm text-zinc-500">Your personal appearance settings for this dashboard.</p>
      </div>

      <ThemeForm
        initialTheme={(profile?.theme_preference as 'light' | 'dark' | 'system') ?? 'system'}
        initialAccentColor={profile?.accent_color ?? '#0F6E5B'}
        initialCustomColors={profile?.custom_accent_colors ?? []}
        initialFontId={profile?.font_preference ?? DEFAULT_FONT_ID}
      />
    </div>
  );
}
