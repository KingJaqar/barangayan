'use client';

import { ContentEditDialog } from '@/components/admin/content-edit-dialog';
import editStyles from '@/components/admin/content-edit-dialog.module.css';

import { AdminSelect } from '@/components/admin/dropdown/admin-select';

import styles from '@/components/admin/content-workspace.module.css';

import { faqArticleSchema, FAQ_CATEGORY_META, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { beginAttempt, notify as toast } from '@/lib/notify';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';

type FaqArticle = Tables<'faq_articles'>;

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';

export function FaqRow({ article }: { article: FaqArticle }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [question, setQuestion] = useState(article.question);
  const [answer, setAnswer] = useState(article.answer);
  const [category, setCategory] = useState(article.category);
  const [sortOrder, setSortOrder] = useState(String(article.sort_order));
  const [isActive, setIsActive] = useState(article.is_active);

  const isArchived = article.deleted_at !== null;

  function startEdit() {
    setQuestion(article.question);
    setAnswer(article.answer);
    setCategory(article.category);
    setSortOrder(String(article.sort_order));
    setIsActive(article.is_active);
    setError(null);
    setIsEditing(true);
  }

  async function handleSave(event: React.FormEvent) {
    const toastAttempt = beginAttempt('handleSave');
    try {
      event.preventDefault();
      setError(null);

      const parsed = faqArticleSchema.safeParse({
        question,
        answer,
        category,
        sort_order: sortOrder ? parseInt(sortOrder, 10) : 0,
        is_active: isActive,
      });

      if (!parsed.success) {
        toast.error('Review the highlighted fields before continuing.', { id: toastAttempt });
        setError(parsed.error.issues[0]?.message ?? 'Invalid input');
        return;
      }

      setSubmitting(true);
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase
        .from('faq_articles')
        .update({
          question: parsed.data.question,
          answer: parsed.data.answer,
          category: parsed.data.category,
          sort_order: parsed.data.sort_order,
          is_active: parsed.data.is_active,
        })
        .eq('id', article.id);
      setSubmitting(false);

      if (updateError) {
        setError(updateError.message);
        toast.error(`Failed to save: ${updateError.message}`, { id: toastAttempt });
        return;
      }

      logAdminAction({
        action: 'update',
        entityType: 'faq_article',
        entityId: article.id,
        entityLabel: parsed.data.question,
        changes: {
          before: {
            question: article.question,
            answer: article.answer,
            category: article.category,
            sort_order: article.sort_order,
            is_active: article.is_active,
          },
          after: {
            question: parsed.data.question,
            answer: parsed.data.answer,
            category: parsed.data.category,
            sort_order: parsed.data.sort_order,
            is_active: parsed.data.is_active,
          },
        },
      }).catch(() => {});

      toast.success('Article updated.', { id: toastAttempt });
      setIsEditing(false);
      router.refresh();

    } catch {
      toast.warning('The action could not be confirmed. Refresh the record before trying again.', { id: toastAttempt });
    } finally { setSubmitting(false); }
  }

  async function archive() {
    const toastAttempt = beginAttempt('archive');
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: archiveError } = await supabase
        .from('faq_articles')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', article.id);
      if (archiveError) {
        toast.error(`Failed to archive: ${archiveError.message}`, { id: toastAttempt });
        return;
      }

      logAdminAction({
        action: 'delete',
        entityType: 'faq_article',
        entityId: article.id,
        entityLabel: article.question,
        metadata: { question: article.question, answer: article.answer, category: article.category },
      }).catch(() => {});

      toast.success('Article archived.', { id: toastAttempt });
      router.refresh();

    } catch {
      toast.warning('The action could not be confirmed. Refresh the record before trying again.', { id: toastAttempt });
    }
  }

  async function unarchive() {
    const toastAttempt = beginAttempt('unarchive');
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: unarchiveError } = await supabase
        .from('faq_articles')
        .update({ deleted_at: null })
        .eq('id', article.id);
      if (unarchiveError) {
        toast.error(`Failed to restore: ${unarchiveError.message}`, { id: toastAttempt });
        return;
      }

      logAdminAction({
        action: 'update',
        entityType: 'faq_article',
        entityId: article.id,
        entityLabel: article.question,
        metadata: { restored: true },
      }).catch(() => {});

      toast.success('Article restored.', { id: toastAttempt });
      router.refresh();

    } catch {
      toast.warning('The action could not be confirmed. Refresh the record before trying again.', { id: toastAttempt });
    }
  }

  async function handleDelete() {
    const toastAttempt = beginAttempt('handleDelete');
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: deleteError } = await supabase
        .from('faq_articles')
        .delete()
        .eq('id', article.id);
      if (deleteError) {
        toast.error(`Failed to delete: ${deleteError.message}`, { id: toastAttempt });
        return;
      }

      logAdminAction({
        action: 'delete',
        entityType: 'faq_article',
        entityId: article.id,
        entityLabel: article.question,
        metadata: { hard: true, question: article.question, answer: article.answer, category: article.category },
      }).catch(() => {});

      toast.success('Article permanently deleted.', { id: toastAttempt });
      router.refresh();

    } catch {
      toast.warning('The action could not be confirmed. Refresh the record before trying again.', { id: toastAttempt });
    }
  }

  const meta = FAQ_CATEGORY_META[article.category as keyof typeof FAQ_CATEGORY_META];

  return (
    <>
    <ContentEditDialog open={isEditing} title="Edit FAQ article" context={article.question}
      description="Update the answer, category, display order, and publication status." busy={submitting} onClose={() => setIsEditing(false)}>
      <form
        onSubmit={handleSave}
        className={editStyles.form} aria-busy={submitting}>
        <div className={editStyles.fields} data-edit-scroll>
        <fieldset disabled={submitting}>
          <div className={editStyles.grid}>
            <label className={editStyles.full}>
              <span className="mb-1 block font-medium">Question</span>
              <input className={inputClass} value={question} onChange={(e) => setQuestion(e.target.value)} required />
            </label>

            <label className={editStyles.full}>
              <span className="mb-1 block font-medium">Answer</span>
              <textarea
                className={inputClass}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={4}
                required
              />
            </label>

            <h3 className={editStyles.groupTitle}>Publication</h3>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Category</span>
              <AdminSelect kind="faq" className={inputClass} value={category} onValueChange={(nextValue) => setCategory(nextValue)}>
                {Object.entries(FAQ_CATEGORY_META).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </AdminSelect>
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium">Sort Order</span>
              <input
                className={inputClass}
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </label>

            <label className={`${editStyles.full} flex items-center gap-2 text-sm`}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              <span className="font-medium">Published</span>
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
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: meta?.color }}
            />
            <span
              className={styles.badge}>
              {meta?.label}
            </span>
            <h3 className={styles.rowTitle}>
              {article.question}
            </h3>
            {isArchived ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                Archived
              </span>
            ) : !article.is_active ? (
              <span className={styles.badge}>
                Draft
              </span>
            ) : null}
          </div>
          <p className={styles.rowMeta}>Sort order: {article.sort_order}</p>
        </div>

        <div className={styles.rowActions}>
          {isArchived ? (
            <>
              <ConfirmButton
                label="Restore"
                confirmLabel="Restore?"
                onConfirm={unarchive}
                title="Restore article"
                className={styles.primaryAction}
              />
              <ConfirmButton
                label="Delete"
                confirmLabel="Delete forever?"
                onConfirm={handleDelete}
                title="Permanently delete article"
                className={styles.dangerAction}
              />
            </>
          ) : (
            <>
              <button
                onClick={startEdit} aria-haspopup="dialog"
                title="Edit"
                className={styles.primaryAction}>
                Edit
              </button>
              <ConfirmButton
                label="Archive"
                confirmLabel="Archive?"
                onConfirm={archive}
                title="Archive article"
                className={styles.dangerAction}
              />
            </>
          )}
        </div>
      </div>

      <div className={styles.rowDescription}>
        <p className="line-clamp-2">{article.answer}</p>
      </div>
    </div>
    </>
  );
}
