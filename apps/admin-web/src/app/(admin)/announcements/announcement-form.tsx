'use client';

import { AdminSelect } from '@/components/admin/dropdown/admin-select';

import { ContentFormActions } from '@/components/admin/content-create-panel';
import styles from '@/components/admin/content-forms.module.css';

import { announcementSchema, ANNOUNCEMENT_CATEGORY_META, ANNOUNCEMENT_CATEGORIES } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';
const labelClass = 'mb-1 block text-xs font-medium text-zinc-500';

export function AnnouncementForm({ barangayId }: { barangayId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [detailedDescription, setDetailedDescription] = useState('');
  const [category, setCategory] = useState<string>('general');
  const [imageUrl, setImageUrl] = useState('');
  const [publishedAt, setPublishedAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const result = announcementSchema.safeParse({
      title,
      body,
      detailed_description: detailedDescription || undefined,
      category,
      image_url: imageUrl || undefined,
      published_at: publishedAt ? new Date(publishedAt).toISOString() : undefined,
    });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error: insertError } = await supabase.from('announcements').insert({
      barangay_id: barangayId,
      title: result.data.title,
      body: result.data.body,
      detailed_description: result.data.detailed_description || null,
      category: result.data.category,
      image_url: result.data.image_url || null,
      published_at: result.data.published_at ?? new Date().toISOString(),
    });
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      toast.showError(`Failed to create announcement: ${insertError.message}`);
      return;
    }

    logAdminAction({
      action: 'create',
      entityType: 'announcement',
      entityLabel: result.data.title,
      metadata: {
        title: result.data.title,
        body: result.data.body,
        detailed_description: result.data.detailed_description ?? null,
        category: result.data.category,
        published_at: result.data.published_at ?? null,
      },
    }).catch(() => {});

    setTitle('');
    setBody('');
    setDetailedDescription('');
    setCategory('general');
    setImageUrl('');
    setPublishedAt('');
    toast.showSuccess(`Announcement published.`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className={`${styles.form} grid grid-cols-1 gap-5 sm:grid-cols-2`}>
      <label className="sm:col-span-2 text-sm">
        <span className={labelClass}>Title</span>
        <input
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Typhoon Advisory: Signal No. 2 Raised"
          required
        />
      </label>

      <label className="sm:col-span-2 text-sm">
        <span className={labelClass}>Body</span>
        <textarea
          className={inputClass}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Short summary shown on the announcement card (2 sentences or so)…"
          required
        />
      </label>

      <label className="sm:col-span-2 text-sm">
        <span className={labelClass}>Detailed Description (optional)</span>
        <textarea
          className={inputClass}
          value={detailedDescription}
          onChange={(e) => setDetailedDescription(e.target.value)}
          rows={4}
          placeholder="Full write-up shown when a resident taps the announcement for more detail…"
        />
      </label>

      <div className={styles.groupHeading}><h3>Publication</h3></div>

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
        <span className={labelClass}>Publish At (optional)</span>
        <input
          type="datetime-local"
          className={inputClass}
          value={publishedAt}
          onChange={(e) => setPublishedAt(e.target.value)}
        />
      </label>

      <div className={styles.groupHeading}><h3>Media</h3></div>

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

      {error ? <p role="alert" className="sm:col-span-2 text-sm text-red-600">{error}</p> : null}

      <ContentFormActions busy={submitting}>
        <button
          type="submit"
          disabled={submitting || !barangayId}
          className="rounded-full bg-[var(--accent)] px-5 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          aria-busy={submitting}>
          <LoadingButtonContent pending={submitting} pendingLabel="Publishing…">Publish Announcement</LoadingButtonContent>
        </button>
      </ContentFormActions>
    </form>
  );
}
