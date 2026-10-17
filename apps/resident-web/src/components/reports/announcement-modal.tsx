'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useRef, type CSSProperties } from 'react';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
import { X, Clock } from 'lucide-react';
import { ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory, type Tables } from '@barangayan/shared';

import { renderIonicon } from '@/lib/ionicon-map';
import { dialogTransition } from '@/lib/motion';
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
  /** Kept populated during the exit animation so the dialog never blanks. */
  announcement: AnnouncementRow | null;
  onClose: () => void;
}

/**
 * Centered announcement detail dialog.
 * A Radix modal dialog (focus moves in and is trapped, Escape and the backdrop close it,
 * focus returns to the card that opened it, and the title names the dialog), with
 * Framer Motion driving a gentle fade and scale with the shared dialog timing.
 * Props only — opening it never fetches anything.
 */
export function AnnouncementModal({ visible, announcement, onClose }: AnnouncementModalProps) {
  // The dialog has no Radix trigger, so remember what had focus (the opening card) and
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
                animate={{ opacity: 1, transition: dialogTransition.enter }}
                exit={{ opacity: 0, transition: dialogTransition.exit }}
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
                className={styles.dialog}
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0, transition: dialogTransition.enter }}
                exit={{ opacity: 0, scale: 0.98, y: 8, transition: dialogTransition.exit }}>
                <DialogBody announcement={announcement} />
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

function DialogBody({ announcement }: { announcement: AnnouncementRow }) {
  // Exiting controls are inert so nothing hidden stays focusable.
  const isPresent = useIsPresent();
  const category = (announcement.category ?? 'general') as AnnouncementCategory;
  const meta = ANNOUNCEMENT_CATEGORY_META[category] ?? ANNOUNCEMENT_CATEGORY_META.general;
  const { color, icon, label } = meta;
  const detail = announcement.detailed_description?.trim() || announcement.body || '';

  return (
    <div inert={!isPresent} className={`${styles.dialogBody} ${styles.categoryTheme}`} style={{ '--announcement-category': color } as CSSProperties}>
      <div className={styles.dialogHeader}>
        {/* Header: category chip + close button */}
        <div className="flex items-center justify-between">
          <div className={`${styles.category} ${styles.dialogCategory}`}>
            {renderIonicon(icon, { size: 14, 'aria-hidden': true })}
            {label}
          </div>
          <DialogPrimitive.Close
            aria-label="Close"
            className={`${styles.closeButton} ${styles.dialogClose}`}>
            <X aria-hidden size={18} />
          </DialogPrimitive.Close>
        </div>

        {/* Title */}
        <DialogPrimitive.Title className={styles.dialogTitle}>{announcement.title}</DialogPrimitive.Title>

        {/* Timestamp */}
        <div className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <Clock aria-hidden size={14} className="mt-0.5 shrink-0" />
          <span>{timeAgo(announcement.published_at)} · {formatDateTime(announcement.published_at)}</span>
        </div>
      </div>

      {/* Full body scrolls independently so the title and close control stay visible. */}
      <div className={styles.dialogContent}>
        <DialogPrimitive.Description className={styles.detail}>{detail}</DialogPrimitive.Description>
      </div>
    </div>
  );
}
