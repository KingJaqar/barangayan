'use client';

/**
 * Right-side sliding drawer for a selected drive registration — opened from
 * my-registrations-content.tsx without a full navigation, so the My Registrations list
 * stays visible/interactive behind it. Modeled directly on reports/incident-drawer.tsx
 * and health/register-drawer.tsx: Radix Dialog primitives, `modal={false}`, no overlay,
 * `forceMount` + framer-motion driving the slide-in/out, outside-interaction suppressed
 * so clicking a different card (handled by my-registrations-content.tsx re-selecting an
 * id) never races Radix's own click-outside-closes behavior.
 *
 * Unlike IncidentDrawer/RegisterDrawer, no fetch happens here — the parent already holds
 * the full DriveRegistrationRow (joined with its drive) from useMedicalDrives, so this
 * just renders it. Replaces the old centered/dimming RegistrationDetailDialog.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { ClipboardList, Star, X } from 'lucide-react';

import { driveTypeConfig, type DriveRegistrationRow } from '@/hooks/use-medical-drives';

const STATUS_COLOR: Record<string, string> = {
  pending: '#F59E0B',
  confirmed: 'var(--accent)',
  attended: '#6366F1',
  cancelled: '#EF4444',
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function RegistrationDrawer({ registration, open, onClose }: { registration: DriveRegistrationRow | null; open: boolean; onClose: () => void }) {
  const drive = registration?.drive;
  const cfg = drive ? driveTypeConfig(drive.type) : null;
  const statusColor = registration ? (STATUS_COLOR[registration.status] ?? 'var(--accent)') : 'var(--accent)';

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }} modal={false}>
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            {/* No Overlay: My Registrations stays fully lit and interactive while the
                drawer is open — clicking another card just swaps its content. */}
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
                    <ClipboardList size={14} /> Registration Details
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="sr-only">
                    Status, applicant number, and details for the selected drive registration.
                  </DialogPrimitive.Description>
                  <DialogPrimitive.Close className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
                    <X size={18} />
                    <span className="sr-only">Close</span>
                  </DialogPrimitive.Close>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                  {!registration ? null : (
                    <div className="flex flex-col gap-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-base font-bold leading-snug">{drive?.title ?? 'Medical Drive'}</h2>
                        {cfg ? (
                          <span className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold" style={{ backgroundColor: `${cfg.color}22`, color: cfg.color }}>
                            {cfg.label}
                          </span>
                        ) : null}
                      </div>

                      <div className="rounded-xl bg-muted px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Applicant Number</p>
                            <p className="text-lg font-bold text-primary">{registration.applicant_number}</p>
                          </div>
                          <span className="flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                            <Star size={12} /> {registration.priority_score} pts
                          </span>
                        </div>
                      </div>

                      <span className="w-fit rounded-full px-2.5 py-1 text-xs font-bold capitalize" style={{ backgroundColor: `${statusColor}22`, color: statusColor }}>
                        {registration.status}
                      </span>

                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-muted-foreground">
                        <dt>Registered on</dt>
                        <dd className="text-right font-medium text-foreground">{fmtDate(registration.created_at)}</dd>
                        <dt>Age</dt>
                        <dd className="text-right font-medium text-foreground">{registration.age}</dd>
                        <dt>PWD</dt>
                        <dd className="text-right font-medium text-foreground">{registration.is_pwd ? 'Yes' : 'No'}</dd>
                        {registration.comorbidities.length > 0 ? (
                          <>
                            <dt>Comorbidities</dt>
                            <dd className="text-right font-medium text-foreground">{registration.comorbidities.join(', ')}</dd>
                          </>
                        ) : null}
                        {drive ? (
                          <>
                            <dt>Location</dt>
                            <dd className="text-right font-medium text-foreground">{drive.location}</dd>
                          </>
                        ) : null}
                      </dl>
                    </div>
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
