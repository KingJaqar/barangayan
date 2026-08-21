'use client';

/**
 * Right-side sliding drawer for a selected incident report — opened from
 * my-reports-tabs.tsx without a full navigation, so the reports list stays
 * visible/interactive behind it. Modeled directly on
 * services/requests/request-drawer.tsx: Radix Dialog primitives, `modal={false}`, no
 * overlay, `forceMount` + framer-motion driving the slide-in/out, outside-interaction
 * suppressed so clicking a different card (handled by my-reports-tabs.tsx re-selecting
 * an id) never races Radix's own click-outside-closes behavior.
 *
 * Fetches the full row itself (rather than being handed one) since the list only
 * selects a lean column set — same `select(...)` as
 * reports/[incidentId]/page.tsx, run against the browser Supabase client. The existing
 * `/reports/[incidentId]` route is left intact for deep links/back-button/refresh —
 * this drawer is just the primary interaction on the list.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { FileWarning, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { IncidentDetailBody, type IncidentDetailData } from '@/app/(resident)/reports/[incidentId]/incident-detail';

function DrawerSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      <span className="block h-40 w-full animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
      <span className="block h-6 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <span className="block h-4 w-1/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <span className="block h-28 w-full animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
      <span className="block h-20 w-full animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

export function IncidentDrawer({ incidentId, open, onClose }: { incidentId: string | null; open: boolean; onClose: () => void }) {
  const [incident, setIncident] = useState<IncidentDetailData | null>(null);

  useEffect(() => {
    if (!incidentId) {
      // Routed through a microtask (not a direct setState) — react-hooks/set-state-in-
      // effect flags any setState reachable synchronously from an effect body, same
      // workaround as request-drawer.tsx's "no id" branch.
      Promise.resolve().then(() => setIncident(null));
      return;
    }

    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setIncident(null);
    });

    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;

      // Same reporter_id scoping as reports/[incidentId]/page.tsx — RLS lets a resident
      // read any barangay incident (for the map), so this filter is what keeps the
      // drawer to "my reports" only, not just a UI convenience.
      supabase
        .from('incidents')
        .select(`
          id, title, description, status, photo_urls, created_at, updated_at, confirmation_count,
          resolved_read_at, address, specific_area_details, location, deleted_at,
          incident_categories(id, name, color, icon)
        `)
        .eq('id', incidentId)
        .eq('reporter_id', user.id)
        .is('deleted_at', null)
        .single()
        .then(({ data }) => {
          if (cancelled) return;
          setIncident((data as unknown as IncidentDetailData) ?? null);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [incidentId]);

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
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 32, stiffness: 300 }}>
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.06]">
                  <DialogPrimitive.Title className="flex items-center gap-1.5 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                    <FileWarning size={14} /> Incident Report
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="sr-only">
                    Status, location, and tracking details for the selected incident report.
                  </DialogPrimitive.Description>
                  <DialogPrimitive.Close className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
                    <X size={18} />
                    <span className="sr-only">Close</span>
                  </DialogPrimitive.Close>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                  {!incident ? <DrawerSkeleton /> : <IncidentDetailBody incident={incident} />}
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
