'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useRef, type CSSProperties } from 'react';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
import { X, Clock } from 'lucide-react';
import { ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory, type Tables } from '@barangayan/shared';

import { renderIonicon } from '@/lib/ionicon-map';
import { drawerTransition } from '@/lib/motion';
import styles from './announcements.module.css';

type AnnouncementRow = Tables<'announcements'>;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso));
}

interface AnnouncementModalProps {
  visible: boolean;
  /** Kept populated while visible=false so the sheet can slide down without blanking — same
   * pattern as mobile's AnnouncementModal. */
  announcement: AnnouncementRow | null;
  onClose: () => void;
}

/**
 * Bottom-sheet detail for an announcement — web counterpart of mobile's AnnouncementModal.
 * A Radix modal dialog (focus moves in and is trapped, Escape and the backdrop close it,
 * focus returns to the card that opened it, and the title names the dialog), with
 * Framer Motion driving the shared drawer timing: 240 ms slide-up, 180 ms exit, no
 * bounce. Props only — opening it never fetches anything.
 */
export function AnnouncementModal({ visible, announcement, onClose }: AnnouncementModalProps) {
  // The sheet has no Radix trigger, so remember what had focus (the opening card) and
  // give it back on close.
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <DialogPrimitive.Root open={visible} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AnimatePresence>
        {visible && announcement ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className={styles.overlay}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: drawerTransition.enter }}
                exit={{ opacity: 0, transition: drawerTransition.exit }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content
              asChild
              forceMount
              onOpenAutoFocus={() => {
                returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                returnFocus.current?.focus();
              }}>
              <motion.div
                className={styles.sheet}
                initial={{ y: '100%' }}
                animate={{ y: 0, transition: drawerTransition.enter }}
                exit={{ y: '100%', transition: drawerTransition.exit }}>
                <SheetBody announcement={announcement} />
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

function SheetBody({ announcement }: { announcement: AnnouncementRow }) {
  // While the sheet slides out, its controls are inert so nothing hidden stays focusable.
  const isPresent = useIsPresent();
  const category = (announcement.category ?? 'general') as AnnouncementCategory;
  const meta = ANNOUNCEMENT_CATEGORY_META[category] ?? ANNOUNCEMENT_CATEGORY_META.general;
  const { color, icon, label } = meta;
  const detail = announcement.detailed_description?.trim() || announcement.body || '';

  return (
    <div inert={!isPresent}>
      {/* Handle */}
      <div aria-hidden className="flex justify-center pt-3 pb-1">
        <div className="h-1 w-9 rounded-full bg-border" />
      </div>

      <div className={`${styles.sheetBody} ${styles.categoryTheme}`} style={{ '--announcement-category': color } as CSSProperties}>
        {/* Header: category chip + close button */}
        <div className="flex items-center justify-between">
          <div className={styles.category}>
            {renderIonicon(icon, { size: 14, 'aria-hidden': true })}
            {label}
          </div>
          <DialogPrimitive.Close
            aria-label="Close"
            className={styles.closeButton}>
            <X aria-hidden size={18} />
          </DialogPrimitive.Close>
        </div>

        {/* Title */}
        <DialogPrimitive.Title className={styles.sheetTitle}>{announcement.title}</DialogPrimitive.Title>

        {/* Timestamp */}
        <div className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <Clock aria-hidden size={14} className="mt-0.5 shrink-0" />
          <span>{timeAgo(announcement.published_at)} · {formatDateTime(announcement.published_at)}</span>
        </div>

        <hr className="border-border" />

        {/* Full body */}
        <DialogPrimitive.Description className={styles.detail}>{detail}</DialogPrimitive.Description>
      </div>
    </div>
  );
}
