'use client';

import { ClipboardList } from 'lucide-react';
import { useState } from 'react';

import { RegistrationDrawer } from '@/components/health/registration-drawer';
import { driveTypeConfig, useMedicalDrives, type DriveRegistrationRow } from '@/hooks/use-medical-drives';

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'attended' | 'cancelled';

const STATUS_KEYS: StatusFilter[] = ['all', 'pending', 'confirmed', 'attended', 'cancelled'];
const STATUS_COLOR: Record<StatusFilter, string> = {
  all: 'var(--accent)',
  pending: '#F59E0B',
  confirmed: 'var(--accent)',
  attended: '#6366F1',
  cancelled: '#EF4444',
};

function fmtShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** My Registrations segment [C-016] — list of drive_registrations joined with medical_drives.
 * Tapping a card opens RegistrationDrawer (right-side sliding panel, no dimming overlay)
 * instead of a centered modal, same pattern as reports/my-reports-tabs.tsx: the list
 * stays visible/interactive behind it and reflows to a single column once the drawer is
 * open so a resident can still browse and switch to another registration. */
export function MyRegistrationsContent({ userId }: { userId: string }) {
  const { myRegistrations, loadingRegistrations } = useMedicalDrives({ typeFilter: 'all', userId });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const drawerOpen = selectedId !== null;
  const selected = myRegistrations.find((r) => r.id === selectedId) ?? null;

  const filtered = statusFilter === 'all' ? myRegistrations : myRegistrations.filter((r) => r.status === statusFilter);

  return (
    <div
      className={`flex flex-col gap-4 transition-[max-width] duration-300 ${
        drawerOpen ? 'lg:mr-[calc(32rem_+_2rem)]' : ''
      }`}>
      <div>
        <h1 className="text-xl font-bold">My Registrations</h1>
        <p className="text-sm text-muted-foreground">Applications you&apos;ve submitted for medical and vaccination drives.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_KEYS.map((key) => {
          const isActive = statusFilter === key;
          const color = STATUS_COLOR[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors"
              style={isActive ? { backgroundColor: color, color: '#fff' } : { borderWidth: 1, borderStyle: 'solid', borderColor: `${color}55`, color, backgroundColor: `${color}0d` }}>
              {key}
            </button>
          );
        })}
      </div>

      {loadingRegistrations ? (
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-black/8 bg-muted dark:border-white/8" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-black/8 bg-white px-6 py-16 text-center dark:border-white/8 dark:bg-zinc-900">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <ClipboardList size={28} className="text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">No registrations yet</p>
            <p className="text-sm text-muted-foreground">Register for an active medical drive to see it here.</p>
          </div>
        </div>
      ) : (
        // Multi-column when nothing is selected, forced back to a single column once the
        // drawer opens — same reflow as reports/incident-drawer.tsx's IncidentList.
        <div className={`grid grid-cols-1 gap-3 ${drawerOpen ? '' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
          {filtered.map((reg: DriveRegistrationRow) => {
            const cfg = reg.drive ? driveTypeConfig(reg.drive.type) : null;
            const statusColor = STATUS_COLOR[reg.status as StatusFilter] ?? 'var(--accent)';
            const isSelected = reg.id === selectedId;
            return (
              <button
                key={reg.id}
                type="button"
                aria-current={isSelected ? 'true' : undefined}
                onClick={() => setSelectedId(reg.id)}
                className={`flex flex-col gap-2 rounded-xl border bg-white p-3.5 text-left shadow-sm transition-shadow hover:shadow-md dark:bg-zinc-900 ${
                  isSelected ? 'border-[var(--accent)]' : 'border-black/8 dark:border-white/8'
                }`}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-bold leading-snug">{reg.drive?.title ?? 'Medical Drive'}</h3>
                  {cfg ? (
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: `${cfg.color}1a`, color: cfg.color }}>
                      {cfg.label}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-primary">{reg.applicant_number}</span>
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize" style={{ backgroundColor: `${statusColor}1a`, color: statusColor }}>
                    {reg.status}
                  </span>
                </div>
                {reg.drive ? <p className="text-xs text-muted-foreground">{fmtShortDate(reg.drive.drive_date)} · {reg.drive.location}</p> : null}
              </button>
            );
          })}
        </div>
      )}

      <RegistrationDrawer registration={selected} open={drawerOpen} onClose={() => setSelectedId(null)} />
    </div>
  );
}
