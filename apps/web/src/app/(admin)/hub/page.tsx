import { createSupabaseServerClient } from '@/lib/supabase/server';

import { EmergencyForm } from './emergency-form';
import { EmergencyRow } from './emergency-row';

export default async function HubPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('barangay_id').eq('id', user!.id).single();
  const { data: items } = await supabase
    .from('emergency_information')
    .select('*')
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('published_at', { ascending: false });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Emergency Hub</h1>
          <p className="text-sm text-zinc-500">
            Manage emergency guidelines and hotlines pushed to residents.
          </p>
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
          New Entry
        </h2>
        <EmergencyForm barangayId={profile?.barangay_id ?? ''} />
      </div>

      <h2 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
        Published Entries
      </h2>
      <div className="flex flex-col gap-3">
        {(items ?? []).map((item) => (
          <EmergencyRow key={item.id} item={item} />
        ))}
        {(items ?? []).length === 0 ? (
          <p className="text-center text-sm text-zinc-500">
            No entries yet — create one above.
          </p>
        ) : null}
      </div>
    </div>
  );
}
