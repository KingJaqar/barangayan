'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { TriangleAlert, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MultiPolygon, Polygon } from 'geojson';
import { needsResidentProfile, residentCompletionDestination } from '@barangayan/shared';
import { NewReportForm, type NewReportFormProps } from '@/app/(resident)/reports/new/new-report-form';
import { LoadingStatus } from '@/components/shared/loading-status';
import { Button } from '@/components/ui/button';
import { withBoundaryFallback } from '@/lib/barangay-boundary';
import { drawerTransition } from '@/lib/motion';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

function ReportFormContent({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: () => void }) {
  const router = useRouter();
  const [data, setData] = useState<NewReportFormProps | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setError(false);
      try {
        const client = createSupabaseBrowserClient();
        const { data: { user }, error: authError } = await client.auth.getUser();
        if (!active) return;
        if (authError) throw authError;
        if (!user) {
          router.push('/login?next=%2Freports%2Fnew');
          return;
        }
        const incomplete = await needsResidentProfile(client, user.id);
        if (!active) return;
        if (incomplete) {
          router.push(residentCompletionDestination('/reports/new'));
          return;
        }
        const { data: profile, error: profileError } = await client.from('profiles')
          .select('barangay_id').eq('id', user.id).single();
        if (profileError || !profile) throw profileError ?? new Error('Missing profile');
        const [categories, zones, barangay] = await Promise.all([
          client.from('incident_categories').select('id, name, color, is_trash_related, icon').order('name'),
          client.from('waste_zones').select('id, name').eq('barangay_id', profile.barangay_id).order('name'),
          client.from('barangays').select('boundary').eq('id', profile.barangay_id).single(),
        ]);
        if (categories.error || zones.error || barangay.error) throw new Error('Unable to load report form');
        if (active) setData({
          categories: categories.data ?? [],
          zones: zones.data ?? [],
          barangayId: profile.barangay_id,
          boundary: withBoundaryFallback((barangay.data?.boundary as Polygon | MultiPolygon | null) ?? null),
        });
      } catch {
        if (active) setError(true);
      }
    }
    void Promise.resolve().then(() => { if (active) void load(); });
    return () => { active = false; };
  }, [router, retry]);

  if (error) return (
    <div role="alert" className="flex flex-col items-start gap-3 text-sm">
      <p>We couldn&apos;t load the report form. Check your connection, then try again.</p>
      <Button type="button" size="sm" onClick={() => setRetry((value) => value + 1)}>Retry loading form</Button>
    </div>
  );
  if (!data) return <LoadingStatus active label="Loading report form…" />;
  return <NewReportForm {...data} onCancel={onClose} onSubmitted={onSubmitted} />;
}

/** Matches the nonmodal Document Details sheet, including its outside-click behavior. */
export function NewReportDrawer({ open, onClose, onSubmitted }: {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(value) => { if (!value) onClose(); }} modal={false}>
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Content asChild forceMount
              onOpenAutoFocus={(event) => event.preventDefault()}
              onCloseAutoFocus={(event) => event.preventDefault()}
              onInteractOutside={(event) => event.preventDefault()}
              onPointerDownOutside={(event) => event.preventDefault()}>
              <motion.div
                className="pointer-events-auto fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-900 sm:max-w-xl md:max-w-2xl"
                initial={{ x: '100%' }} animate={{ x: 0, transition: drawerTransition.enter }}
                exit={{ x: '100%', transition: drawerTransition.exit }}>
                <div className="flex shrink-0 flex-col gap-3 border-b border-black/[0.06] px-6 py-4 dark:border-white/[0.06]">
                  <div className="flex items-center justify-between gap-3">
                    <DialogPrimitive.Title className="flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                      <TriangleAlert size={14} className="shrink-0" /> Report an Incident
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className="sr-only">Describe an incident and submit it to your barangay.</DialogPrimitive.Description>
                    <DialogPrimitive.Close className="shrink-0 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
                      <X size={18} /><span className="sr-only">Close</span>
                    </DialogPrimitive.Close>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-6">
                  <ReportFormContent onClose={onClose} onSubmitted={onSubmitted} />
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
