'use client';

import { faqArticleSchema, FAQ_CATEGORIES, FAQ_CATEGORY_META } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';

export function FaqForm({ barangayId }: { barangayId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState<string>('general');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
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
    const { error: insertError } = await supabase.from('faq_articles').insert({
      barangay_id: barangayId,
      question: parsed.data.question,
      answer: parsed.data.answer,
      category: parsed.data.category,
      sort_order: parsed.data.sort_order,
      is_active: parsed.data.is_active,
    });
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      toast.showError(`Failed to create article: ${insertError.message}`);
      return;
    }

    setQuestion('');
    setAnswer('');
    setCategory('general');
    setSortOrder('0');
    setIsActive(true);
    toast.showSuccess('FAQ article published.');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
      <label className="col-span-2 text-sm">
        <span className="mb-1 block font-medium">Question</span>
        <input
          className={inputClass}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. How do I request a Barangay Clearance?"
          required
        />
      </label>

      <label className="col-span-2 text-sm">
        <span className="mb-1 block font-medium">Answer</span>
        <textarea
          className={inputClass}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={4}
          placeholder="Helpful answer visible to residents…"
          required
        />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium">Category</span>
        <select
          className={inputClass}
          value={category}
          onChange={(e) => setCategory(e.target.value)}>
          {FAQ_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {FAQ_CATEGORY_META[cat].label}
            </option>
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
          placeholder="0"
        />
      </label>

      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-zinc-300"
        />
        <span className="font-medium">Published (visible to residents)</span>
      </label>

      {error ? <p className="col-span-2 text-sm text-red-600">{error}</p> : null}

      <div className="col-span-2">
        <button
          type="submit"
          disabled={submitting || !barangayId}
          className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {submitting ? 'Publishing…' : 'Publish Article'}
        </button>
      </div>
    </form>
  );
}
