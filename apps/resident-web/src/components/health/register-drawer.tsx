'use client';

/**
 * Right-side sliding drawer for registering a resident (or household member) into a
 * medical drive — opened from active-drives-content.tsx without a full navigation, so
 * Active Drives (calendar + filter + drive list) stays visible/interactive behind it.
 * Modeled directly on reports/incident-drawer.tsx: Radix Dialog primitives, `modal={false}`,
 * no overlay, `forceMount` + framer-motion driving the slide-in/out, outside-interaction
 * suppressed so clicking Register on a different drive (handled by active-drives-content.tsx
 * re-selecting an id) never races Radix's own click-outside-closes behavior.
 *
 * Fetches the drive row + the profile fields ApplicantForm needs itself (rather than
 * being handed server props), same client-fetch pattern as IncidentDrawer — the existing
 * `/health/register/[driveId]` route is left intact for deep links/back-button/refresh —
 * this drawer is just the primary interaction from the Active Drives list.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { HeartPulse, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ApplicantForm } from '@/components/health/applicant-form';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { MedicalDrive } from '@/hooks/use-medical-drives';

interface HouseholdMember {
  id: string;
  name: string;
  relation: string;
  role?: string;
}

interface RegisterDrawerData {
  drive: MedicalDrive;
  residentName: string;
  residentBirthDate: string | null;
  residentAddress: string | null;
  householdMembers: HouseholdMember[];
}

function DrawerSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      <span className="block h-32 w-full animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
      <span className="block h-10 w-full animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      <span className="block h-24 w-full animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      <span className="block h-40 w-full animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

export function RegisterDrawer({
  driveId,
  open,
  onClose,
  userId,
}: {
  driveId: string | null;
  open: boolean;
  onClose: () => void;
  /** Always a real id in practice — guests never reach this drawer (DriveCard renders a
   * "Log In to Register" link instead of triggering it, see drive-card.tsx). Typed
   * nullable anyway since active-drives-content.tsx's own userId is `string | null` and
   * this drawer is always mounted regardless of auth state; the effect below just no-ops
   * without one. */
  userId: string | null;
}) {
  const [data, setData] = useState<RegisterDrawerData | null>(null);

  useEffect(() => {
    if (!driveId || !userId) {
      // Routed through a microtask (not a direct setState) — react-hooks/set-state-in-
      // effect flags any setState reachable synchronously from an effect body, same
      // workaround as incident-drawer.tsx's "no id" branch.
      Promise.resolve().then(() => setData(null));
      return;
    }

    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setData(null);
    });

    const supabase = createSupabaseBrowserClient();
    Promise.all([
      supabase.from('medical_drives').select('*').eq('id', driveId).eq('is_active', true).is('deleted_at', null).single(),
      supabase.from('profiles').select('full_name, birth_date, home_address, household_members').eq('id', userId).single(),
    ]).then(([{ data: drive }, { data: profile }]) => {
      if (cancelled || !drive || !profile) return;
      const householdMembers = Array.isArray(profile.household_members)
        ? (profile.household_members as unknown as HouseholdMember[])
        : [];
      setData({
        drive: drive as MedicalDrive,
        residentName: profile.full_name,
        residentBirthDate: profile.birth_date ?? null,
        residentAddress: profile.home_address ?? null,
        householdMembers,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [driveId, userId]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }} modal={false}>
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            {/* No Overlay: Active Drives stays fully lit and interactive while the drawer
                is open — clicking Register on another drive just swaps its content. */}
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
                    <HeartPulse size={14} /> Drive Registration
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="sr-only">
                    Register yourself or a household member for the selected medical drive.
                  </DialogPrimitive.Description>
                  <DialogPrimitive.Close className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
                    <X size={18} />
                    <span className="sr-only">Close</span>
                  </DialogPrimitive.Close>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                  {!data ? (
                    <DrawerSkeleton />
                  ) : (
                    <ApplicantForm
                      drive={data.drive}
                      residentName={data.residentName}
                      residentBirthDate={data.residentBirthDate}
                      residentAddress={data.residentAddress}
                      householdMembers={data.householdMembers}
                      onDone={onClose}
                    />
                  )}
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
