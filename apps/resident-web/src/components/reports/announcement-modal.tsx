'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X, Clock } from 'lucide-react';
import { ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory, type Tables } from '@barangayan/shared';

import { renderIonicon } from '@/lib/ionicon-map';

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
 * Uses Framer Motion AnimatePresence + a slide-up sheet so the open/close feel matches
 * mobile's spring-open behaviour (plan §1's design-system choice: shadcn/Framer Motion).
 */
export function AnnouncementModal({ visible, announcement, onClose }: AnnouncementModalProps) {
  const category = (announcement?.category ?? 'general') as AnnouncementCategory;
  const meta = ANNOUNCEMENT_CATEGORY_META[category] ?? ANNOUNCEMENT_CATEGORY_META.general;
  const { color, icon, label } = meta;
  const detail = announcement?.detailed_description?.trim() || announcement?.body || '';

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-40 bg-black/45"
            onClick={onClose}
            aria-label="Close announcement"
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.9 }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-2xl rounded-t-3xl bg-background pb-safe-bottom shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-9 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            </div>

            <div className="flex max-h-[80dvh] flex-col gap-3 overflow-y-auto px-5 pb-6 pt-3">
              {announcement && (
                <>
                  {/* Header: category chip + close button */}
                  <div className="flex items-center justify-between">
                    <div
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide"
                      style={{ backgroundColor: `${color}1A`, color }}>
                      {renderIonicon(icon, { size: 13, color })}
                      {label}
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="Close"
                      className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80">
                      <X size={18} />
                    </button>
                  </div>

                  {/* Title */}
                  <h2 className="text-lg font-bold leading-snug tracking-tight">{announcement.title}</h2>

                  {/* Timestamp */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock size={13} />
                    <span>{timeAgo(announcement.published_at)} · {formatDateTime(announcement.published_at)}</span>
                  </div>

                  <hr className="border-border" />

                  {/* Full body */}
                  <p className="whitespace-pre-line text-sm leading-relaxed">{detail}</p>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
