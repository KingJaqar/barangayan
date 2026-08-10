'use client';

import { faqArticleSchema, FAQ_CATEGORY_META, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ConfirmButton } from '@/components/admin/confirm-button';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type FaqArticle = Tables<'faq_articles'>;

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800';

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
    toast.showSuccess(`Article archived.`);
    router.refresh();
  }

  const meta = FAQ_CATEGORY_META[article.category as keyof typeof FAQ_CATEGORY_META];

  if (isEditing) {
    return (
      <form
        onSubmit={handleSave}
        className="rounded-xl border border-[#0F6E5B] bg-white p-4 dark:border-[#0F6E5B] dark:bg-zinc-900">
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
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              {Object.entries(FAQ_CATEGORY_META).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
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
              className="rounded-full bg-[#0F6E5B] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save Changes'}
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
    <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: meta?.color }}
            />
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: `${meta?.color}1A`, color: meta?.color }}>
              {meta?.label}
            </span>
            <span className="font-semibold">{article.question}</span>
            {!article.is_active ? (
              <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                Draft
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-zinc-500">Sort order: {article.sort_order}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={startEdit}
            title="Edit"
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-[#0F6E5B]/10 hover:text-[#0F6E5B] dark:hover:bg-[#0F6E5B]/20">
            Edit
          </button>
          <ConfirmButton
            label="Archive"
            confirmLabel="Archive?"
            onConfirm={archive}
            title="Archive article"
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:hover:bg-red-900/30 dark:hover:text-red-300"
          />
        </div>
      </div>

      <div className="mt-3 border-t border-black/5 pt-3 dark:border-white/5">
        <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-300">{article.answer}</p>
      </div>
    </div>
  );
}
