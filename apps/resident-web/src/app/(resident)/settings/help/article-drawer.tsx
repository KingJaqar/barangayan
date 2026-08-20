'use client';

/**
 * Right-side sliding drawer for a selected FAQ article — opened from HelpCenterClient
 * without a full navigation, so the Help Center list stays visible/interactive behind
 * it. Built on Radix's Dialog primitives directly (not the centered `components/ui/
 * dialog.tsx`) for the free Escape/close-button/aria wiring, with `forceMount` +
 * framer-motion driving the actual slide-in/out — Radix's own mount-on-`open`
 * behavior can't produce an exit animation on its own.
 *
 * Deliberately non-modal (`modal={false}`, no overlay, outside interaction left
 * enabled): the spec calls for the rest of the screen staying fully accessible while
 * the drawer is open — no dimming, no disabled background, no focus trap — so the
 * resident can keep filtering/scrolling/clicking other cards in the list behind it.
 * `onInteractOutside`/`onPointerDownOutside` are suppressed so clicking another card
 * (handled by HelpCenterClient re-selecting an id) never races Radix's own
 * click-outside-closes behavior — the drawer only closes via its own Close button or
 * Escape.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { FAQ_CATEGORY_META, type FaqCategory } from '@barangayan/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { HelpCircle, X } from 'lucide-react';

import type { FaqArticle } from '@/hooks/use-faq-articles';

export function ArticleDrawer({
  article,
  open,
  onClose,
}: {
  article: FaqArticle | null;
  open: boolean;
  onClose: () => void;
}) {
  const category = article ? (article.category as FaqCategory) : null;
  const meta = category ? FAQ_CATEGORY_META[category] : null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }} modal={false}>
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            {/* No Overlay: the spec wants the rest of the screen to stay fully lit
                and interactive, not dimmed or blocked, while the drawer is open. */}
            <DialogPrimitive.Content
              asChild
              forceMount
              onOpenAutoFocus={(e) => e.preventDefault()}
              onCloseAutoFocus={(e) => e.preventDefault()}
              onInteractOutside={(e) => e.preventDefault()}
              onPointerDownOutside={(e) => e.preventDefault()}>
              <motion.div
                className="pointer-events-auto fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-900 sm:max-w-lg"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 32, stiffness: 300 }}>
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.06]">
                  <DialogPrimitive.Title className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                    Help Article
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="sr-only">
                    Full text of the selected help center article.
                  </DialogPrimitive.Description>
                  <DialogPrimitive.Close className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
                    <X size={18} />
                    <span className="sr-only">Close</span>
                  </DialogPrimitive.Close>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                  <AnimatePresence mode="wait">
                    {article ? (
                      <motion.div
                        key={article.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}>
                        {meta ? (
                          <span
                            className="mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide"
                            style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}>
                            <HelpCircle size={13} />
                            {meta.label}
                          </span>
                        ) : null}
                        <h2 className="text-lg font-bold tracking-tight">{article.question}</h2>
                        <hr className="my-4 border-black/[0.06] dark:border-white/[0.06]" />
                        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                          {article.answer}
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
