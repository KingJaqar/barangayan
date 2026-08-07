'use client';

import { announcementSchema, ANNOUNCEMENT_CATEGORY_META, ANNOUNCEMENT_CATEGORIES } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800';

export function AnnouncementForm({ barangayId }: { barangayId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
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

    setTitle('');
    setBody('');
    setCategory('general');
    setImageUrl('');
    setPublishedAt('');
    toast.showSuccess(`Announcement published.`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
      <label className="col-span-2 text-sm">
        <span className="mb-1 block font-medium">Title</span>
        <input
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Typhoon Advisory: Signal No. 2 Raised"
          required
        />
      </label>

      <label className="col-span-2 text-sm">
        <span className="mb-1 block font-medium">Body</span>
        <textarea
          className={inputClass}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Announcement details visible to all residents…"
          required
        />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium">Category</span>
        <select
          className={inputClass}
          value={category}
          onChange={(e) => setCategory(e.target.value)}>
          {ANNOUNCEMENT_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {ANNOUNCEMENT_CATEGORY_META[cat].label}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium">Publish At (optional)</span>
        <input
          type="datetime-local"
          className={inputClass}
          value={publishedAt}
          onChange={(e) => setPublishedAt(e.target.value)}
        />
      </label>

      <label className="col-span-2 text-sm">
        <span className="mb-1 block font-medium">Image URL (optional)</span>
        <input
          className={inputClass}
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
          type="url"
        />
      </label>

      {error ? <p className="col-span-2 text-sm text-red-600">{error}</p> : null}

      <div className="col-span-2">
        <button
          type="submit"
          disabled={submitting || !barangayId}
          className="rounded-full bg-[#0F6E5B] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {submitting ? 'Publishing…' : 'Publish Announcement'}
        </button>
      </div>
    </form>
  );
}
