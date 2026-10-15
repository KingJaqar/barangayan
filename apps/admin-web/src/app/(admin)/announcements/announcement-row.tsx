'use client';

import { AdminSelect } from '@/components/admin/dropdown/admin-select';

import styles from '@/components/admin/content-workspace.module.css';

import { announcementSchema, ANNOUNCEMENT_CATEGORY_META, ANNOUNCEMENT_CATEGORIES, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';

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
  const [detailedDescription, setDetailedDescription] = useState(announcement.detailed_description ?? '');
  const [category, setCategory] = useState(announcement.category);
  const [imageUrl, setImageUrl] = useState(announcement.image_url ?? '');

  function startEdit() {
    setTitle(announcement.title);
    setBody(announcement.body);
    setDetailedDescription(announcement.detailed_description ?? '');
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
      detailed_description: detailedDescription || undefined,
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
        detailed_description: result.data.detailed_description || null,
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
        before: {
          title: announcement.title,
          body: announcement.body,
          detailed_description: announcement.detailed_description,
          category: announcement.category,
        },
        after: {
          title: result.data.title,
          body: result.data.body,
          detailed_description: result.data.detailed_description || null,
          category: result.data.category,
        },
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
      metadata: { title: announcement.title, body: announcement.body, category: announcement.category },
    }).catch(() => {});

    toast.showSuccess(`Announcement archived.`);
    router.refresh();
  }

  const meta = ANNOUNCEMENT_CATEGORY_META[announcement.category as keyof typeof ANNOUNCEMENT_CATEGORY_META];

  if (isEditing) {
    return (
      <form
        onSubmit={handleSave}
        className={styles.rowEdit}>
        <div className="grid grid-cols-4 gap-3">
          <label className="col-span-4 text-sm sm:col-span-2">
            <span className={labelClass}>Title</span>
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>

          <label className="text-sm">
            <span className={labelClass}>Category</span>
            <AdminSelect className={inputClass} value={category} onValueChange={(nextValue) => setCategory(nextValue)}>
              {ANNOUNCEMENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {ANNOUNCEMENT_CATEGORY_META[cat].label}
                </option>
              ))}
            </AdminSelect>
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

          <label className="col-span-4 text-sm">
            <span className={labelClass}>Detailed Description (optional)</span>
            <textarea
              className={inputClass}
              value={detailedDescription}
              onChange={(e) => setDetailedDescription(e.target.value)}
              rows={4}
              placeholder="Full write-up shown when a resident taps the announcement for more detail…"
            />
          </label>

          {error ? <p className="col-span-4 text-sm text-red-600">{error}</p> : null}

          <div className="col-span-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[var(--accent)] px-5 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              aria-busy={submitting}>
              <LoadingButtonContent pending={submitting} pendingLabel="Saving…">Save Changes</LoadingButtonContent>
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
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <div className={styles.rowMain}>
          <div className="flex flex-wrap items-center gap-2">
            {/* Category color dot + badge */}
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: meta?.color }}
            />
            <span
              className={`${styles.badge} ${announcement.category === 'emergency' ? styles.urgentStatus : ''}`}>
              {meta?.label}
            </span>
            <h3 className={styles.rowTitle}>{announcement.title}</h3>
          </div>
          <p className={styles.rowMeta}>{formatPublishedAt(announcement.published_at)}</p>
        </div>

      </div>

      <div className={styles.rowDescription}>
        <p className="line-clamp-2">{announcement.body}</p>
      </div>
      <div className={`${styles.rowActions} mt-4`}>
        <button type="button" onClick={startEdit} aria-label={`Edit ${announcement.title}`}
          className={styles.primaryAction}>Edit announcement</button>
        <ConfirmButton label="Archive" ariaLabel={`Archive ${announcement.title}`}
          confirmLabel="Archive?" onConfirm={archive} className={styles.dangerAction} />
      </div>
    </div>
  );
}
