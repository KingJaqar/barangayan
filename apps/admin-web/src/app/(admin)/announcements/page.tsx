import { createSupabaseServerClient } from '@/lib/supabase/server';

import { AnnouncementCatalog } from './announcement-catalog';
import { AnnouncementForm } from './announcement-form';

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
      {/* Section 1: header + description */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Announcements</h1>
        <p className="text-sm text-zinc-500">Create and manage barangay announcements pushed to residents.</p>
      </div>

      {/* Section 2: add item form */}
      <div className="mb-6 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">New Announcement</h2>
        <AnnouncementForm barangayId={profile?.barangay_id ?? ''} />
      </div>

      {/* Sections 3 + 4: filter controls / search bar, and existing items */}
      <h2 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Published Announcements</h2>
      <AnnouncementCatalog announcements={announcements ?? []} />
    </div>
  );
}
