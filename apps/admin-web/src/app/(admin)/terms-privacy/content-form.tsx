'use client';

import { siteContentSchema, SITE_CONTENT_SECTION_META, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { ArrowUpRight, Check, Eye, PencilLine } from 'lucide-react';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';
import styles from './terms-privacy.module.css';

type SiteContentRow = Tables<'site_content'>;
type Section = 'terms_of_service' | 'privacy_policy';

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
        entityId: initial?.id,
        entityLabel: SITE_CONTENT_SECTION_META[section].label,
        changes: {
          before: initial
            ? { title: initial.title, body: initial.body, is_active: initial.is_active }
            : {},
          after: { title: parsed.data.title, body: parsed.data.body, is_active: parsed.data.is_active },
        },
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
    <form onSubmit={handleSubmit} className={styles.editor} aria-label={`${SITE_CONTENT_SECTION_META[section].label} editor`}>
      <div className={styles.editorHeader}>
        <div>
          <p className={styles.eyebrow}>{showPreview ? 'Document preview' : 'Document editor'}</p>
          <h2>{SITE_CONTENT_SECTION_META[section].label}</h2>
        </div>
        <div className={styles.viewToggle} role="group" aria-label="Document view">
          <button type="button" aria-pressed={!showPreview} onClick={() => setShowPreview(false)}><PencilLine size={14} aria-hidden="true" />Edit</button>
          <button type="button" aria-pressed={showPreview} onClick={() => setShowPreview(true)}><Eye size={14} aria-hidden="true" />Preview</button>
        </div>
      </div>

      {showPreview ? (
        <div className={styles.preview}>
          <p className={styles.eyebrow}>Resident view</p>
          <h1>{title}</h1>
          {body ? <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{body}</ReactMarkdown> : <p className={styles.emptyPreview}>Your policy content will appear here. Return to Edit to start writing.</p>}
        </div>
      ) : (
        <div className={styles.fields}>
          <label className={styles.field}>
            <span>Document title</span>
            <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldHeading}>Policy content <span>Markdown supported</span></span>
            <textarea
              className={styles.textarea}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={16}
              placeholder="Write the full content here…"
              required
              aria-describedby="policy-format-help"
            />
          </label>
          <p id="policy-format-help" className={styles.formatHelp}>Use # for headings, **bold** for emphasis, and - for lists.</p>
        </div>
      )}

      <div className={styles.publishing}>
        <label className={styles.publishLabel}>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span className={styles.checkbox} aria-hidden="true">{isActive && <Check size={13} strokeWidth={2.5} />}</span>
          <span><strong>Published</strong><span>Visible to residents after saving</span></span>
        </label>
        <span className={styles.visibility}>{isActive ? 'Visible' : 'Hidden'}</span>
      </div>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <div className={styles.footer}>
        <p>Review your policy before saving.<br /><span>Changes apply to this document only.</span></p>
        <button
          type="submit"
          disabled={submitting || !barangayId}
          className={styles.saveButton}
          aria-busy={submitting}>
          <LoadingButtonContent pending={submitting} pendingLabel="Saving…">Save Changes</LoadingButtonContent>
          {!submitting && <ArrowUpRight size={16} aria-hidden="true" />}
        </button>
      </div>
    </form>
  );
}
