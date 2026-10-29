'use client';

import { ContentEditDialog } from '@/components/admin/content-edit-dialog';
import editStyles from '@/components/admin/content-edit-dialog.module.css';

import { AdminSelect } from '@/components/admin/dropdown/admin-select';

import styles from '@/components/admin/content-workspace.module.css';

import { announcementSchema, ANNOUNCEMENT_CATEGORY_META, ANNOUNCEMENT_CATEGORIES, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { beginAttempt, notify as toast } from '@/lib/notify';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';
import { announcementDateTimeInput, announcementDateTimeIso } from '@/lib/announcement-datetime';

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

  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(announcement.title);
  const [body, setBody] = useState(announcement.body);
  const [detailedDescription, setDetailedDescription] = useState(announcement.detailed_description ?? '');
  const [category, setCategory] = useState(announcement.category);
  const [imageUrl, setImageUrl] = useState(announcement.image_url ?? '');
  const [alertExpiresAt, setAlertExpiresAt] = useState(announcementDateTimeInput(announcement.alert_expires_at));
  const saving = useRef(false);

  function startEdit() {
    setTitle(announcement.title);
    setBody(announcement.body);
    setDetailedDescription(announcement.detailed_description ?? '');
    setCategory(announcement.category);
    setImageUrl(announcement.image_url ?? '');
    setAlertExpiresAt(announcementDateTimeInput(announcement.alert_expires_at));
    setError(null);
    setIsEditing(true);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true;
    const toastAttempt = beginAttempt('handleSave');
    try {
      setError(null);

      const result = announcementSchema.safeParse({
        title,
        body,
        detailed_description: detailedDescription || undefined,
        category,
        image_url: imageUrl || undefined,
        published_at: alertExpiresAt ? announcement.published_at : undefined,
        alert_expires_at: alertExpiresAt === announcementDateTimeInput(announcement.alert_expires_at)
          ? announcement.alert_expires_at ?? null
          : alertExpiresAt ? announcementDateTimeIso(alertExpiresAt) ?? alertExpiresAt : null,
      });

      if (!result.success) {
        toast.error('Review the highlighted fields before continuing.', { id: toastAttempt });
        setError(result.error.issues[0]?.message ?? 'Invalid input');
        return;
      }

      setSubmitting(true);
      const supabase = createSupabaseBrowserClient();
      const { data: saved, error: updateError } = await supabase
        .from('announcements')
        .update({
          title: result.data.title,
          body: result.data.body,
          detailed_description: result.data.detailed_description || null,
          category: result.data.category,
          image_url: result.data.image_url || null,
          alert_expires_at: result.data.alert_expires_at ?? null,
        })
        .eq('id', announcement.id).select('id').maybeSingle();
      setSubmitting(false);

      if (updateError || !saved) {
        const message = updateError?.message ?? 'This announcement is unavailable or you no longer have permission to edit it.';
        setError(message);
        toast.error(`Failed to save: ${message}`, { id: toastAttempt });
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
            alert_expires_at: announcement.alert_expires_at,
          },
          after: {
            title: result.data.title,
            body: result.data.body,
            detailed_description: result.data.detailed_description || null,
            category: result.data.category,
            alert_expires_at: result.data.alert_expires_at ?? null,
          },
        },
      }).catch(() => {});

      toast.success('Announcement updated.', { id: toastAttempt });
      setIsEditing(false);
      router.refresh();

    } catch {
      setError('The action could not be confirmed. Refresh the record before trying again.');
      toast.warning('The action could not be confirmed. Refresh the record before trying again.', { id: toastAttempt });
    } finally { saving.current = false; setSubmitting(false); }
  }

  async function archive() {
    const toastAttempt = beginAttempt('archive');
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: archiveError } = await supabase
        .from('announcements')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', announcement.id);
      if (archiveError) {
        toast.error(`Failed to archive: ${archiveError.message}`, { id: toastAttempt });
        return;
      }

      logAdminAction({
        action: 'delete',
        entityType: 'announcement',
        entityId: announcement.id,
        entityLabel: announcement.title,
        metadata: { title: announcement.title, body: announcement.body, category: announcement.category },
      }).catch(() => {});

      toast.success(`Announcement archived.`, { id: toastAttempt });
      router.refresh();

    } catch {
      toast.warning('The action could not be confirmed. Refresh the record before trying again.', { id: toastAttempt });
    }
  }

  const meta = ANNOUNCEMENT_CATEGORY_META[announcement.category as keyof typeof ANNOUNCEMENT_CATEGORY_META];

  return (
    <>
    <ContentEditDialog open={isEditing} title="Edit announcement" context={announcement.title}
      description="Update the content, category, and optional image shown to residents." busy={submitting} onClose={() => setIsEditing(false)}>
      <form
        onSubmit={handleSave}
        className={editStyles.form} aria-busy={submitting}>
        <div className={editStyles.fields} data-edit-scroll>
        <fieldset disabled={submitting}>
          <div className={editStyles.grid}>
            <label className={editStyles.full}>
              <span className={labelClass}>Title</span>
              <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>

            <label className="text-sm">
              <span className={labelClass}>Category</span>
              <AdminSelect kind="announcement" className={inputClass} value={category} onValueChange={(nextValue) => setCategory(nextValue)}>
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

            <label className={editStyles.full}>
              <span className={labelClass}>Advisory expires at (optional)</span>
              <input type="datetime-local" step="0.001" className={inputClass} value={alertExpiresAt}
                onChange={(event) => setAlertExpiresAt(event.target.value)} />
              <span className={labelClass}>Emergency advisories only. Uses your local time. Clear this before choosing another category.</span>
            </label>

            <label className={editStyles.full}>
              <span className={labelClass}>Body</span>
              <textarea
                className={inputClass}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                required
              />
            </label>

            <label className={editStyles.full}>
              <span className={labelClass}>Detailed Description (optional)</span>
              <textarea
                className={inputClass}
                value={detailedDescription}
                onChange={(e) => setDetailedDescription(e.target.value)}
                rows={4}
                placeholder="Full write-up shown when a resident taps the announcement for more detail…"
              />
            </label>

            {error ? <p role="alert" className={`${editStyles.full} ${editStyles.error}`}>{error}</p> : null}

          </div>
        </fieldset>
        </div>
        <div className={editStyles.actions}>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            disabled={submitting}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}>
            <LoadingButtonContent pending={submitting} pendingLabel="Saving…">Save Changes</LoadingButtonContent>
          </button>
        </div>
      </form>
    </ContentEditDialog>
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
        <button type="button" onClick={startEdit} aria-haspopup="dialog" aria-label={`Edit ${announcement.title}`}
          className={styles.primaryAction}>Edit announcement</button>
        <ConfirmButton label="Archive" ariaLabel={`Archive ${announcement.title}`}
          confirmLabel="Archive?" onConfirm={archive} className={styles.dangerAction} />
      </div>
    </div>
    </>
  );
}
