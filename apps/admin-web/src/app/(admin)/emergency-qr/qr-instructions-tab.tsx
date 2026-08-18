'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { QrInstructionsModal } from './qr-instructions-modal';
import { MobilePreviewCard } from './mobile-preview-card';
import type { Tables } from '@barangayan/shared';

type DbEmergencyQrContent = Tables<'emergency_qr_content'>;

const SECTION_META: Record<string, { label: string; icon: string }> = {
  why_scan: { label: 'Why Scan', icon: 'qr-code-outline' },
  how_it_works: { label: 'How It Works', icon: 'help-circle-outline' },
};

export function QrInstructionsTab({
  initialContent,
  barangayId,
}: {
  initialContent: DbEmergencyQrContent[];
  barangayId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [content, setContent] = useState<DbEmergencyQrContent[]>(initialContent);

  // Re-sync with the server's rows whenever a refresh delivers new ones. Adjusting state
  // during render is React's recommended way to do this — an effect would render the stale
  // rows first, then immediately render again.
  const [prevInitialContent, setPrevInitialContent] = useState(initialContent);
  if (prevInitialContent !== initialContent) {
    setPrevInitialContent(initialContent);
    setContent(initialContent);
  }

  const whyScan = content.find((c) => c.section === 'why_scan');
  const howItWorks = content.find((c) => c.section === 'how_it_works');

  async function toggleActive(section: string, current: boolean) {
    const existing = content.find((c) => c.section === section);
    if (!existing?.id) return;

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from('emergency_qr_content')
      .update({ is_active: !current })
      .eq('id', existing.id);

    if (error) {
      toast.showError(`Failed to update: ${error.message}`);
      return;
    }

    setContent((prev) => prev.map((c) => (c.section === section ? { ...c, is_active: !current } : c)));
    toast.showSuccess('Status updated.');
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        {['why_scan', 'how_it_works'].map((section) => {
          const record = content.find((c) => c.section === section);
          const meta = SECTION_META[section];
          const isActive = record?.is_active ?? true;
          const steps = Array.isArray(record?.content) ? record.content.length : 0;

          return (
            <div
              key={section}
              className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{meta.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}>
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">{record?.title ?? 'Not configured'}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {steps} steps
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => setEditingSection(section)}
                    title="Edit"
                    className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] dark:hover:bg-[var(--accent)]/20">
                    ✏️ Edit
                  </button>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => toggleActive(section, isActive)}
                      className="peer sr-only"
                    />
                    <div className="h-5 w-9 rounded-full bg-zinc-200 peer-checked:bg-[var(--accent)] dark:bg-zinc-700 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <MobilePreviewCard whyScan={whyScan} howItWorks={howItWorks} />
      </div>

      {editingSection && (
        <QrInstructionsModal
          section={editingSection}
          barangayId={barangayId}
          existing={editingSection === 'why_scan' ? whyScan : howItWorks}
          onClose={() => setEditingSection(null)}
          onSaved={(updated) => {
            setContent((prev) => {
              const idx = prev.findIndex((c) => c.section === updated.section);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = updated;
                return next;
              }
              return [...prev, updated];
            });
            setEditingSection(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}