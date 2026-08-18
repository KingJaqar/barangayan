'use client';

import { emergencyInformationSchema, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type EmergencyInformation = Tables<'emergency_information'>;

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';
const labelClass = 'mb-1 block text-xs font-medium text-zinc-500';

const DEFAULT_ICON = 'information-circle-outline';
const DEFAULT_ICON_COLOR = '#0F6E5B';
const DEFAULT_ICON_BG = '#E6F2EF';

export function EmergencyForm({ barangayId, item }: { barangayId: string; item?: EmergencyInformation }) {
  const router = useRouter();
  const toast = useToast();
  const isEditing = !!item;

  const [title, setTitle] = useState(item?.title ?? '');
  const [body, setBody] = useState(item?.body ?? '');
  const [category, setCategory] = useState(item?.category ?? 'guidelines');
  const [icon, setIcon] = useState(item?.icon ?? DEFAULT_ICON);
  const [iconColor, setIconColor] = useState(item?.icon_color ?? DEFAULT_ICON_COLOR);
  const [iconBg, setIconBg] = useState(item?.icon_bg ?? DEFAULT_ICON_BG);
  const [sortOrder, setSortOrder] = useState(String(item?.sort_order ?? 0));
  const [isActive, setIsActive] = useState(item?.is_active ?? true);
  const [publishedAt, setPublishedAt] = useState(
    item?.published_at ? new Date(item.published_at).toISOString().slice(0, 16) : '',
  );
  const [contentLines, setContentLines] = useState(() => {
    if (!item?.content || !Array.isArray(item.content)) return '';
    if (typeof item.content[0] === 'string') {
      return (item.content as string[]).join('\n');
    }
    return (item.content as { label: string; number: string }[])
      .map((c) => `${c.label} | ${c.number}`)
      .join('\n');
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function parseContent(raw: string) {
    const lines = raw.split('\n').filter((line) => line.trim() !== '');
    if (category === 'guidelines') {
      return lines.map((line) => line.trim());
    }
    return lines.map((line) => {
      const trimmed = line.trim();
      const [labelPart, numberPart] = trimmed.split('|').map((s) => s.trim());
      if (numberPart) {
        return { label: labelPart, number: numberPart };
      }
      return { label: trimmed, number: trimmed };
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const content = parseContent(contentLines);

    const result = emergencyInformationSchema.safeParse({
      title,
      body,
      category,
      icon: icon || DEFAULT_ICON,
      icon_color: iconColor || DEFAULT_ICON_COLOR,
      icon_bg: iconBg || DEFAULT_ICON_BG,
      content,
      sort_order: sortOrder ? Number(sortOrder) : 0,
      is_active: isActive,
      published_at: publishedAt ? new Date(publishedAt).toISOString() : undefined,
    });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();

    const payload = {
      barangay_id: barangayId,
      title: result.data.title,
      body: result.data.body,
      category: result.data.category,
      icon: result.data.icon,
      icon_color: result.data.icon_color,
      icon_bg: result.data.icon_bg,
      content: result.data.content,
      sort_order: result.data.sort_order,
      is_active: result.data.is_active,
      published_at: result.data.published_at ?? new Date().toISOString(),
    };

    if (isEditing && item) {
      const { error: updateError } = await supabase
        .from('emergency_information')
        .update(payload)
        .eq('id', item.id);
      if (updateError) {
        setError(updateError.message);
        toast.showError(`Failed to update: ${updateError.message}`);
        setSubmitting(false);
        return;
      }
      toast.showSuccess('Emergency information updated.');
    } else {
      const { error: insertError } = await supabase.from('emergency_information').insert(payload);
      if (insertError) {
        setError(insertError.message);
        toast.showError(`Failed to create: ${insertError.message}`);
        setSubmitting(false);
        return;
      }
      toast.showSuccess('Emergency information published.');
    }

    setSubmitting(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-4 gap-3">
      <label className="col-span-4 text-sm sm:col-span-2">
        <span className={labelClass}>Title</span>
        <input
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Typhoon Preparedness"
          required
        />
      </label>

      <label className="text-sm">
        <span className={labelClass}>Category</span>
        <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="guidelines">Guidelines</option>
          <option value="hotlines">Hotlines</option>
        </select>
      </label>

      <label className="text-sm">
        <span className={labelClass}>Sort Order</span>
        <input
          type="number"
          className={inputClass}
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          placeholder="0"
        />
      </label>

      <label className="col-span-4 text-sm sm:col-span-2">
        <span className={labelClass}>Body</span>
        <textarea
          className={inputClass}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={1}
          placeholder="Short description visible to residents…"
          required
        />
      </label>

      <label className="col-span-4 text-sm sm:col-span-2">
        <span className={labelClass}>
          Content (one item per line) —{' '}
          {category === 'guidelines' ? 'each line is a bullet' : 'Label | Number, e.g. Police | 911'}
        </span>
        <textarea
          className={inputClass}
          value={contentLines}
          onChange={(e) => setContentLines(e.target.value)}
          rows={2}
          placeholder={category === 'guidelines' ? 'Step 1\nStep 2\nStep 3' : 'Police | 911\nFire | 911'}
        />
      </label>

      <label className="text-sm">
        <span className={labelClass}>Icon</span>
        <input className={inputClass} value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="icon-name" />
      </label>

      <label className="text-sm">
        <span className={labelClass}>Icon Color</span>
        <input className={inputClass} value={iconColor} onChange={(e) => setIconColor(e.target.value)} placeholder="#0F6E5B" />
      </label>

      <label className="text-sm">
        <span className={labelClass}>Icon Background</span>
        <input className={inputClass} value={iconBg} onChange={(e) => setIconBg(e.target.value)} placeholder="#E6F2EF" />
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

      <label className="col-span-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-zinc-300"
        />
        <span className="font-medium">Active</span>
      </label>

      {error ? <p className="col-span-4 text-sm text-red-600">{error}</p> : null}

      <div className="col-span-4">
        <button
          type="submit"
          disabled={submitting || !barangayId}
          className="rounded-full bg-[var(--accent)] px-5 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
          {submitting ? (isEditing ? 'Saving…' : 'Publishing…') : (isEditing ? 'Save Changes' : 'Publish')}
        </button>
      </div>
    </form>
  );
}
