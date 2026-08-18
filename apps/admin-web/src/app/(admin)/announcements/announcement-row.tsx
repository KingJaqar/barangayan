'use client';

import { announcementSchema, ANNOUNCEMENT_CATEGORY_META, ANNOUNCEMENT_CATEGORIES, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Announcement = Tables<'announcements'>;

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';
const labelClass = 'mb-1 block text-xs font-medium text-zinc-500';

/** Formats an ISO datetime string for display (e.g. "Aug 7, 2026, 9:00 AM"). */
function formatPublishedAt(iso: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

export function AnnouncementRow({ announcement }: { announcement: Announcement }) {
  const router = useRouter();
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(announcement.title);
  const [body, setBody] = useState(announcement.body);
  const [category, setCategory] = useState(announcement.category);
  const [imageUrl, setImageUrl] = useState(announcement.image_url ?? '');

  function startEdit() {
    setTitle(announcement.title);
    setBody(announcement.body);
    setCategory(announcement.category);
    setImageUrl(announcement.image_url ?? '');
    setError(null);
    setIsEditing(true);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const result = announcementSchema.safeParse({
      title,
      body,
      category,
      image_url: imageUrl || undefined,
    });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase
      .from('announcements')
      .update({
        title: result.data.title,
        body: result.data.body,
        category: result.data.category,
        image_url: result.data.image_url || null,
      })
      .eq('id', announcement.id);
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      toast.showError(`Failed to save: ${updateError.message}`);
      return;
    }

    logAdminAction({
      action: 'update',
      entityType: 'announcement',
      entityId: announcement.id,
      entityLabel: result.data.title,
      changes: {
        before: { title: announcement.title, body: announcement.body, category: announcement.category },
        after:  { title: result.data.title,  body: result.data.body,  category: result.data.category },
      },
    }).catch(() => {});

    toast.showSuccess('Announcement updated.');
    setIsEditing(false);
    router.refresh();
  }

  async function archive() {
    const supabase = createSupabaseBrowserClient();
    const { error: archiveError } = await supabase
      .from('announcements')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', announcement.id);
    if (archiveError) {
      toast.showError(`Failed to archive: ${archiveError.message}`);
      return;
    }

    logAdminAction({
      action: 'delete',
      entityType: 'announcement',
      entityId: announcement.id,
      entityLabel: announcement.title,
    }).catch(() => {});

    toast.showSuccess(`Announcement archived.`);
    router.refresh();
  }

  const meta = ANNOUNCEMENT_CATEGORY_META[announcement.category as keyof typeof ANNOUNCEMENT_CATEGORY_META];

  if (isEditing) {
    return (
      <form
        onSubmit={handleSave}
        className="rounded-xl border border-[var(--accent)] bg-white p-3 dark:border-[var(--accent)] dark:bg-zinc-900">
        <div className="grid grid-cols-4 gap-3">
          <label className="col-span-4 text-sm sm:col-span-2">
            <span className={labelClass}>Title</span>
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>

          <label className="text-sm">
            <span className={labelClass}>Category</span>
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              {ANNOUNCEMENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {ANNOUNCEMENT_CATEGORY_META[cat].label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className={labelClass}>Image URL (optional)</span>
            <input
              className={inputClass}
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…"
              type="url"
            />
          </label>

          <label className="col-span-4 text-sm">
            <span className={labelClass}>Body</span>
            <textarea
              className={inputClass}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              required
            />
          </label>

          {error ? <p className="col-span-4 text-sm text-red-600">{error}</p> : null}

          <div className="col-span-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[var(--accent)] px-5 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={submitting}
              className="rounded-full bg-zinc-200 px-5 py-1.5 text-sm font-semibold disabled:opacity-50 dark:bg-zinc-700">
              Cancel
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Category color dot + badge */}
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: meta?.color }}
            />
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: `${meta?.color}1A`, color: meta?.color }}>
              {meta?.label}
            </span>
            <span className="text-sm font-semibold">{announcement.title}</span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">{formatPublishedAt(announcement.published_at)}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={startEdit}
            title="Edit"
            className="rounded-full px-2.5 py-1 text-xs font-semibold text-zinc-500 hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] dark:hover:bg-[var(--accent)]/20">
            ✏️
          </button>
          <ConfirmButton
            label="🗑"
            confirmLabel="Archive?"
            onConfirm={archive}
            title="Archive"
            className="rounded-full px-2.5 py-1 text-xs font-semibold text-zinc-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:hover:bg-red-900/30 dark:hover:text-red-300"
          />
        </div>
      </div>

      <div className="mt-2 border-t border-black/5 pt-2 dark:border-white/5">
        <p className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-300">{announcement.body}</p>
      </div>
    </div>
  );
}
