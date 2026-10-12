'use client';

/**
 * Right-side sliding drawer for a selected service request — opened from
 * requests-list.tsx without a full navigation, so the request grid stays
 * visible/interactive behind it. Modeled directly on
 * settings/help/article-drawer.tsx: Radix Dialog primitives, `modal={false}`, no
 * overlay, `forceMount` + framer-motion driving the slide-in/out, outside-interaction
 * suppressed so clicking a different card (handled by requests-list.tsx re-selecting an
 * id) never races Radix's own click-outside-closes behavior.
 *
 * Fetches the full row itself (rather than being handed one) since the list only
 * selects a lean column set — same `select('*, document_types(...))` as
 * requests/[requestId]/page.tsx, run against the browser Supabase client. The existing
 * `/services/requests/[requestId]` route is left intact for deep links/back-button/
 * refresh — this drawer is just the primary interaction on the list.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { Tables } from '@barangayan/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, SearchX, TriangleAlert, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { LoadingStatus } from '@/components/shared/loading-status';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/loading';
import { drawerTransition } from '@/lib/motion';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { RequestTracking } from './[requestId]/request-tracking';

type ServiceRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name' | 'processing_target_hours' | 'fee_centavos'> | null;
};

function DrawerSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      <Skeleton className="h-6 w-2/3 rounded" />
      <Skeleton className="h-4 w-1/3 rounded" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
    </div>
  );
}

/**
 * Settled read for one request id. `unavailable` covers a missing, deleted, or
 * inaccessible row (RLS, signed out): PostgREST reports all of them as "no row", and the
 * drawer deliberately doesn't tell them apart. `error` is any other returned error or a
 * thrown failure, which is worth retrying.
 */
type DrawerRead =
  | { id: string; status: 'ready'; request: ServiceRequest }
  | { id: string; status: 'unavailable' }
  | { id: string; status: 'error' };

// PostgREST's `.single()` code for zero rows.
const NO_ROW = 'PGRST116';

function DrawerMessage({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-2 py-12 text-center">
      <Icon aria-hidden size={30} className="text-muted-foreground" />
      <div role="alert" className="flex flex-col gap-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">{children}</div>
    </div>
  );
}

export function RequestDrawer({ requestId, open, onClose }: { requestId: string | null; open: boolean; onClose: () => void }) {
  const [read, setRead] = useState<DrawerRead | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!requestId) {
      // Routed through a microtask (not a direct setState) — react-hooks/set-state-in-
      // effect flags any setState reachable synchronously from an effect body, same
      // workaround as use-unread-counts.tsx's "no user" branch. Clearing on close means
      // reopening the same request starts from a fresh read.
      Promise.resolve().then(() => setRead(null));
      return;
    }

    // `cancelled` drops the response of a selection the resident has already moved
    // away from (or closed), so an older request can never replace the current one.
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    supabase
      .from('service_requests')
      .select('*, document_types(name, processing_target_hours, fee_centavos), payments(document_fee_centavos, amount_centavos, status)')
      .eq('id', requestId)
      .single()
      .then(
        ({ data, error }) => {
          if (cancelled) return;
          if (data) setRead({ id: requestId, status: 'ready', request: data as ServiceRequest });
          else if (!error || error.code === NO_ROW) setRead({ id: requestId, status: 'unavailable' });
          else setRead({ id: requestId, status: 'error' });
        },
        () => {
          if (!cancelled) setRead({ id: requestId, status: 'error' });
        },
      );

    return () => {
      cancelled = true;
    };
  }, [requestId, attempt]);

  // Only a read for the currently selected id is shown, so switching cards goes straight
  // to the loading state instead of flashing the previous request.
  const current = read && read.id === requestId ? read : null;
  const pending = requestId !== null && current === null;

  function retry() {
    // Read-only: repeats the same select, nothing else.
    setRead(null);
    setAttempt((n) => n + 1);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }} modal={false}>
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            {/* No Overlay: the background list stays fully lit and interactive while
                the drawer is open — clicking another card just swaps its content. */}
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
                animate={{ x: 0, transition: drawerTransition.enter }}
                exit={{ x: '100%', transition: drawerTransition.exit }}>
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.06]">
                  <DialogPrimitive.Title className="flex items-center gap-1.5 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                    <FileText size={14} /> Request Tracking
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="sr-only">
                    Status, payment, and tracking details for the selected service request.
                  </DialogPrimitive.Description>
                  <DialogPrimitive.Close className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
                    <X size={18} />
                    <span className="sr-only">Close</span>
                  </DialogPrimitive.Close>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                  {/* The status follows the busy region so its announcement isn't deferred
                      and content never shifts when it disappears. Loading, ready,
                      unavailable, and error are distinct (RW-LT-03 read-state pilot), so a
                      missing or failed read always settles. */}
                  <div aria-busy={pending || undefined}>
                    {current?.status === 'ready' ? (
                      <RequestTracking key={current.request.id} requestId={current.request.id} initialRequest={current.request} />
                    ) : current?.status === 'unavailable' ? (
                      <DrawerMessage
                        icon={SearchX}
                        title="This request isn't available"
                        body="It may have been removed, or it can't be opened from this account. Your request list is still shown behind this panel.">
                        <DialogPrimitive.Close asChild>
                          <Button type="button" variant="outline" size="sm">
                            Close
                          </Button>
                        </DialogPrimitive.Close>
                      </DrawerMessage>
                    ) : current?.status === 'error' ? (
                      <DrawerMessage
                        icon={TriangleAlert}
                        title="We couldn't load this request"
                        body="Check your connection, then try again. Nothing about the request was changed.">
                        <Button type="button" size="sm" onClick={retry}>
                          Try again
                        </Button>
                        <DialogPrimitive.Close asChild>
                          <Button type="button" variant="outline" size="sm">
                            Close
                          </Button>
                        </DialogPrimitive.Close>
                      </DrawerMessage>
                    ) : (
                      <DrawerSkeleton />
                    )}
                  </div>
                  <LoadingStatus active={pending} label="Loading request…" className="px-5" />
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
