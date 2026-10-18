'use client';

import { useState } from 'react';
import { ArrowUpRight, BookOpen, Pencil, ScanLine } from 'lucide-react';
import styles from './emergency-qr.module.css';
import { logAdminAction } from '@/actions/admin-audit-actions';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { beginAttempt, notify as toast } from '@/lib/notify';
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
    const toastAttempt = beginAttempt('toggleActive');
    try {
      const existing = content.find((c) => c.section === section);
      if (!existing?.id) return;

      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from('emergency_qr_content')
        .update({ is_active: !current })
        .eq('id', existing.id);

      if (error) {
        toast.error(`Failed to update: ${error.message}`, { id: toastAttempt });
        return;
      }

      logAdminAction({
        action: 'status_change',
        entityType: 'emergency_qr',
        entityId: existing.id,
        entityLabel: SECTION_META[section].label,
        changes: { before: { is_active: current }, after: { is_active: !current } },
      }).catch(() => {});

      setContent((prev) => prev.map((c) => (c.section === section ? { ...c, is_active: !current } : c)));
      toast.success('Status updated.', { id: toastAttempt });

    } catch {
      toast.warning('The action could not be confirmed. Refresh the record before trying again.', { id: toastAttempt });
    }
  }

  return (
    <div className={styles.instructionsGrid}>
      <div className={styles.editorColumn}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>01 / Resident guidance</p>
          <h2>A little clarity goes a long way.</h2>
          <p>Edit the guidance residents read before they scan. Active sections are visible in the resident app.</p>
        </div>
        {['why_scan', 'how_it_works'].map((section, index) => {
          const record = content.find((c) => c.section === section);
          const meta = SECTION_META[section];
          const isActive = record?.is_active ?? true;
          const steps = Array.isArray(record?.content) ? record.content.length : 0;
          const Icon = section === 'why_scan' ? ScanLine : BookOpen;

          return (
            <article key={section} className={styles.instructionCard}>
              <div className={styles.cardTop}>
                <span className={styles.iconTile}><Icon size={22} aria-hidden="true" /></span>
                <span className={styles.number}>0{index + 1}</span>
              </div>
              <div className={styles.cardTitle}>
                <h3>{meta.label}</h3>
                <span className={styles.badge} data-active={!!record && isActive}>
                  {record ? (isActive ? 'Active' : 'Inactive') : 'Not configured'}
                </span>
              </div>
              <p className={styles.cardDescription}>{record?.title ?? 'Add guidance to help residents check in with confidence.'}</p>
              <div className={styles.cardFooter}>
                <span className={styles.muted}>{steps} {steps === 1 ? 'step' : 'steps'}</span>
                <div className={styles.cardActions}>
                  <label className={styles.toggle}>
                    <input type="checkbox" checked={!!record && isActive} disabled={!record}
                      aria-label={`Show ${meta.label} in resident app`}
                      onChange={() => toggleActive(section, isActive)} />
                    <span aria-hidden="true" />
                  </label>
                  <button onClick={() => setEditingSection(section)} className={styles.editButton}
                    aria-label={`Edit ${meta.label}`}>
                    <Pencil size={14} aria-hidden="true" /> Edit <ArrowUpRight size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <aside className={styles.previewPanel} aria-label="Resident app preview">
        <div className={styles.previewHeading}>
          <div><p className={styles.eyebrow}>The resident view</p><h2>Small screen. Clear steps.</h2></div>
          <span className={styles.badge}>Preview</span>
        </div>
        <MobilePreviewCard whyScan={whyScan} howItWorks={howItWorks} />
        <p className={styles.previewCaption}>A preview of your current instructional content.</p>
      </aside>

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
