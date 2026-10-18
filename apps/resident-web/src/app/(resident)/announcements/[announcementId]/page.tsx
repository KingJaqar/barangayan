import { ANNOUNCEMENT_CATEGORY_META, formatDateTime, type AnnouncementCategory } from '@barangayan/shared';
import { ArrowLeft, Bell } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ReadFailure } from '@/components/shared/read-failure';
import { getOptionalUser } from '@/lib/auth/get-optional-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata = { title: 'Announcement' };

export default async function AnnouncementDetailPage({ params }: { params: Promise<{ announcementId: string }> }) {
  const { announcementId } = await params;
  const { user, profile } = await getOptionalUser();
  if (user && !profile) return <ReadFailure resultId={crypto.randomUUID()} contentName="your barangay information" message="We couldn't load your barangay information." />;
  const supabase = await createSupabaseServerClient();
  let query = supabase.from('announcements').select('id,title,body,detailed_description,category,published_at').eq('id', announcementId).is('deleted_at', null);
  if (profile) query = query.eq('barangay_id', profile.barangay_id);
  const { data: announcement, error } = await query.maybeSingle();
  if (error) return <ReadFailure resultId={crypto.randomUUID()} contentName="this announcement" message="We couldn't load this announcement." />;
  if (!announcement) notFound();
  const category = ANNOUNCEMENT_CATEGORY_META[announcement.category as AnnouncementCategory]?.label ?? 'Announcement';
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/announcements" className="mb-5 inline-flex min-h-8 items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft aria-hidden size={16} /> All announcements</Link>
      <article className="rounded-2xl border border-border bg-card p-5 sm:p-8">
        <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-primary"><Bell aria-hidden size={18} strokeWidth={1.75} />{category}</p>
        <h1 className="break-words text-2xl font-bold tracking-tight">{announcement.title}</h1>
        <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(announcement.published_at)}</p>
        <p className="mt-6 whitespace-pre-wrap break-words text-sm leading-7">{announcement.body}</p>
        {announcement.detailed_description && announcement.detailed_description !== announcement.body ? <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7">{announcement.detailed_description}</p> : null}
      </article>
    </div>
  );
}
