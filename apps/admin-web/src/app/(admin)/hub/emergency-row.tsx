'use client';

import { type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ConfirmButton } from '@/components/admin/confirm-button';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { EmergencyForm } from './emergency-form';

type EmergencyInformation = Tables<'emergency_information'>;

const DEFAULT_ICON_COLOR = '#0F6E5B';

function formatPublishedAt(iso: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

function formatContentPreview(item: EmergencyInformation): string {
  if (!item.content || !Array.isArray(item.content) || item.content.length === 0) {
    return item.body;
  }
  if (item.category === 'guidelines') {
    return (item.content as string[])
      .slice(0, 2)
      .join('; ') + (item.content.length > 2 ? '…' : '');
  }
  const hotlines = item.content as { label: string; number: string }[];
  return (
    hotlines
      .slice(0, 2)
      .map((h) => `${h.label}: ${h.number}`)
      .join('; ') + (hotlines.length > 2 ? '…' : '')
  );
}

export function EmergencyRow({ item }: { item: EmergencyInformation }) {
  const router = useRouter();
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [channelName] = useState(() => `admin-emergency-info-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_information' }, () =>
        router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, channelName]);

  async function archive() {
    const supabase = createSupabaseBrowserClient();
    const { error: archiveError } = await supabase
      .from('emergency_information')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', item.id);
    if (archiveError) {
      toast.showError(`Failed to archive: ${archiveError.message}`);
      return;
    }
    toast.showSuccess('Emergency information archived.');
    router.refresh();
  }

  if (isEditing) {
    return (
      <div className="rounded-xl border border-[var(--accent)] bg-white p-3 dark:border-[var(--accent)] dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Edit</h3>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-semibold disabled:opacity-50 dark:bg-zinc-700">
            Cancel
          </button>
        </div>
        <EmergencyForm barangayId={item.barangay_id} item={item} />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.icon_color || DEFAULT_ICON_COLOR }}
            />
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{
                backgroundColor: `${item.icon_color || DEFAULT_ICON_COLOR}1A`,
                color: item.icon_color || DEFAULT_ICON_COLOR,
              }}>
              {item.category}
            </span>
            <span className="text-sm font-semibold">{item.title}</span>
            {!item.is_active ? (
              <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                Inactive
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">{formatPublishedAt(item.published_at)}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setIsEditing(true)}
            title="Edit"
            className="rounded-full px-2.5 py-1 text-xs font-semibold text-zinc-500 hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] dark:hover:bg-[var(--accent)]/20">
            ✏️
          </button>
          <ConfirmButton
            label="🗑"
            confirmLabel="Archive?"
            onConfirm={archive}
            title="Archive"
            className="rounded-full px-2.5 py-1 text-xs font-semibold text-zinc-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:hover:bg-red-900/30 dark:hover:text-red-300"
          />
        </div>
      </div>

      <div className="mt-2 border-t border-black/5 pt-2 dark:border-white/5">
        <p className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-300">
          {item.body || formatContentPreview(item)}
        </p>
      </div>
    </div>
  );
}
