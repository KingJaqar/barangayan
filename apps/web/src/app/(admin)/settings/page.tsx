import { createSupabaseServerClient } from '@/lib/supabase/server';

import { SettingsForm } from './settings-form';

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('barangay_id')
    .eq('id', user!.id)
    .single();

  if (!profile?.barangay_id) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-4 text-sm text-zinc-500">No barangay assigned to your account.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-zinc-500">
          Manage your barangay&apos;s contact details, operating hours, and feature flags.
        </p>
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
        <SettingsForm barangayId={profile.barangay_id} />
      </div>
    </div>
  );
}
