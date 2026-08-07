import { createSupabaseServerClient } from '@/lib/supabase/server';

import { AnnouncementForm } from './announcement-form';
import { AnnouncementRow } from './announcement-row';

// Admin CRUD for announcements — unlocked by the 0011 migration's
// "admins can manage announcements in their barangay" RLS policy.
export default async function AnnouncementsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('barangay_id').eq('id', user!.id).single();
  const { data: announcements } = await supabase
    .from('announcements')
    .select('*')
    .is('deleted_at', null)
    .order('published_at', { ascending: false });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Announcements</h1>
          <p className="text-sm text-zinc-500">
            Create and manage barangay announcements pushed to residents.
          </p>
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
          New Announcement
        </h2>
        <AnnouncementForm barangayId={profile?.barangay_id ?? ''} />
      </div>

      <h2 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
        Published Announcements
      </h2>
      <div className="flex flex-col gap-3">
        {(announcements ?? []).map((a) => (
          <AnnouncementRow key={a.id} announcement={a} />
        ))}
        {(announcements ?? []).length === 0 ? (
          <p className="text-center text-sm text-zinc-500">
            No announcements yet — create one above.
          </p>
        ) : null}
      </div>
    </div>
  );
}
