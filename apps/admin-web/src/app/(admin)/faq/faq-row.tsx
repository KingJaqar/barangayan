'use client';

import { AdminSelect } from '@/components/admin/dropdown/admin-select';

import styles from '@/components/admin/content-workspace.module.css';

import { faqArticleSchema, FAQ_CATEGORY_META, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';

type FaqArticle = Tables<'faq_articles'>;

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';

export function FaqRow({ article }: { article: FaqArticle }) {
  const router = useRouter();
  const toast = useToast();
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
      toast.showError(`Failed to save: ${updateError.message}`);
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

    toast.showSuccess('Article updated.');
    setIsEditing(false);
    router.refresh();
  }

  async function archive() {
    const supabase = createSupabaseBrowserClient();
    const { error: archiveError } = await supabase
      .from('faq_articles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', article.id);
    if (archiveError) {
      toast.showError(`Failed to archive: ${archiveError.message}`);
      return;
    }

    logAdminAction({
      action: 'delete',
      entityType: 'faq_article',
      entityId: article.id,
      entityLabel: article.question,
      metadata: { question: article.question, answer: article.answer, category: article.category },
    }).catch(() => {});

    toast.showSuccess('Article archived.');
    router.refresh();
  }

  async function unarchive() {
    const supabase = createSupabaseBrowserClient();
    const { error: unarchiveError } = await supabase
      .from('faq_articles')
      .update({ deleted_at: null })
      .eq('id', article.id);
    if (unarchiveError) {
      toast.showError(`Failed to restore: ${unarchiveError.message}`);
      return;
    }

    logAdminAction({
      action: 'update',
      entityType: 'faq_article',
      entityId: article.id,
      entityLabel: article.question,
      metadata: { restored: true },
    }).catch(() => {});

    toast.showSuccess('Article restored.');
    router.refresh();
  }

  async function handleDelete() {
    const supabase = createSupabaseBrowserClient();
    const { error: deleteError } = await supabase
      .from('faq_articles')
      .delete()
      .eq('id', article.id);
    if (deleteError) {
      toast.showError(`Failed to delete: ${deleteError.message}`);
      return;
    }

    logAdminAction({
      action: 'delete',
      entityType: 'faq_article',
      entityId: article.id,
      entityLabel: article.question,
      metadata: { hard: true, question: article.question, answer: article.answer, category: article.category },
    }).catch(() => {});

    toast.showSuccess('Article permanently deleted.');
    router.refresh();
  }

  const meta = FAQ_CATEGORY_META[article.category as keyof typeof FAQ_CATEGORY_META];

  if (isEditing) {
    return (
      <form
        onSubmit={handleSave}
        className={styles.rowEdit}>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 text-sm">
            <span className="mb-1 block font-medium">Question</span>
            <input className={inputClass} value={question} onChange={(e) => setQuestion(e.target.value)} required />
          </label>

          <label className="col-span-2 text-sm">
            <span className="mb-1 block font-medium">Answer</span>
            <textarea
              className={inputClass}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={4}
              required
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium">Category</span>
            <AdminSelect className={inputClass} value={category} onValueChange={(nextValue) => setCategory(nextValue)}>
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

          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            <span className="font-medium">Published</span>
          </label>

          {error ? <p className="col-span-2 text-sm text-red-600">{error}</p> : null}

          <div className="col-span-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              aria-busy={submitting}>
              <LoadingButtonContent pending={submitting} pendingLabel="Saving…">Save Changes</LoadingButtonContent>
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={submitting}
              className="rounded-full bg-zinc-200 px-5 py-2 text-sm font-semibold disabled:opacity-50 dark:bg-zinc-700">
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
                onClick={startEdit}
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
  );
}
