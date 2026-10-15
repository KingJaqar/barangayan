'use client';

import styles from '@/components/admin/content-workspace.module.css';

import { Archive, Pencil } from 'lucide-react';

import { type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { logAdminAction } from '@/actions/admin-audit-actions';
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

    logAdminAction({
      action: 'delete',
      entityType: 'emergency_information',
      entityId: item.id,
      entityLabel: item.title,
      metadata: { title: item.title, body: item.body, category: item.category },
    }).catch(() => {});

    toast.showSuccess('Emergency information archived.');
    router.refresh();
  }

  if (isEditing) {
    return (
      <div className={styles.rowEdit}>
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
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <div className={styles.rowMain}>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.icon_color || DEFAULT_ICON_COLOR }}
            />
            <span
              className={styles.badge}>
              {item.category === 'hotlines' ? 'Hotlines' : 'Guidelines'}
            </span>
            <h3 className={styles.rowTitle}>{item.title}</h3>
            {!item.is_active ? (
              <span className={styles.badge}>
                Inactive
              </span>
            ) : null}
          </div>
          <p className={styles.rowMeta}>{formatPublishedAt(item.published_at)}</p>
        </div>

        <div className={styles.rowActions}>
          <button
            onClick={() => setIsEditing(true)}
            title="Edit"
            aria-label={`Edit ${item.title}`}
            className={styles.primaryAction}>
            <Pencil size={16} aria-hidden="true" />Edit
          </button>
          <ConfirmButton
            label={<><Archive size={16} aria-hidden="true" />Archive</>}
            ariaLabel={`Archive ${item.title}`}
            confirmLabel="Archive?"
            onConfirm={archive}
            title="Archive"
            className={styles.dangerAction}
          />
        </div>
      </div>

      <div className={styles.rowDescription}>
        <p className="line-clamp-2">
          {item.body || formatContentPreview(item)}
        </p>
      </div>
    </div>
  );
}
