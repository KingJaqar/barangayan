'use client';

import { siteContentSchema, SITE_CONTENT_SECTION_META, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type SiteContentRow = Tables<'site_content'>;
type Section = 'terms_of_service' | 'privacy_policy';

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';

export function ContentForm({
  section,
  barangayId,
  initial,
}: {
  section: Section;
  barangayId: string;
  initial: SiteContentRow | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState(initial?.title ?? SITE_CONTENT_SECTION_META[section].label);
  const [body, setBody] = useState(initial?.body ?? '');
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = siteContentSchema.safeParse({
      section,
      title,
      body,
      is_active: isActive,
      sort_order: 0,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    if (!barangayId) {
      setError('Missing barangay context.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();

      // The site_content table uses a partial unique index (where deleted_at is null),
      // which PostgreSQL's ON CONFLICT clause cannot target. Use UPDATE by id when the
      // row already exists, and INSERT when it doesn't.
      const payload = {
        barangay_id: barangayId,
        section: parsed.data.section,
        title: parsed.data.title,
        body: parsed.data.body,
        is_active: parsed.data.is_active,
        sort_order: parsed.data.sort_order,
      };

      const { error: upsertError } = initial?.id
        ? await supabase.from('site_content').update(payload).eq('id', initial.id)
        : await supabase.from('site_content').insert(payload);

      if (upsertError) {
        if (upsertError.code === '42501') {
          toast.showError('Permission denied. You must be an admin.');
        } else {
          toast.showError(`Save failed: ${upsertError.message}`);
        }
        setError(upsertError.message);
        return;
      }

      await logAdminAction({
        action: initial ? 'update' : 'create',
        entityType: 'site_content',
        entityLabel: SITE_CONTENT_SECTION_META[section].label,
      });

      toast.showSuccess('Saved successfully.');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      toast.showError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
          {SITE_CONTENT_SECTION_META[section].label}
        </h2>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="text-xs font-semibold text-[var(--accent)] hover:underline">
          {showPreview ? 'Edit' : 'Preview'}
        </button>
      </div>

      {showPreview ? (
        <div className="prose prose-sm max-w-none rounded-lg border border-zinc-200 p-4 dark:prose-invert dark:border-zinc-700">
          <h1>{title}</h1>
          <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{body}</ReactMarkdown>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Title</span>
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium">Content (Markdown supported)</span>
            <textarea
              className={inputClass}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={16}
              placeholder="Write the full content here…"
              required
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            <span className="font-medium">Published (visible to residents)</span>
          </label>
        </div>
      )}

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-5">
        <button
          type="submit"
          disabled={submitting || !barangayId}
          className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {submitting ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
