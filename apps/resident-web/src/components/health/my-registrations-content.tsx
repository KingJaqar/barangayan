'use client';

import { ClipboardList } from 'lucide-react';
import { useState } from 'react';

import { RegistrationDetailDialog } from '@/components/health/registration-detail-dialog';
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

/** My Registrations segment [C-016] — list of drive_registrations joined with medical_drives. */
export function MyRegistrationsContent({ userId }: { userId: string }) {
  const { myRegistrations, loadingRegistrations } = useMedicalDrives({ typeFilter: 'all', userId });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<DriveRegistrationRow | null>(null);

  const filtered = statusFilter === 'all' ? myRegistrations : myRegistrations.filter((r) => r.status === statusFilter);

  return (
    <div className="flex flex-col gap-4">
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
              style={isActive ? { backgroundColor: color, color: '#fff' } : { borderWidth: 1.5, borderStyle: 'solid', borderColor: color, color }}>
              {key}
            </button>
          );
        })}
      </div>

      {loadingRegistrations ? (
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <ClipboardList size={28} className="text-muted-foreground" />
          <p className="text-sm font-semibold">No registrations yet</p>
          <p className="text-sm text-muted-foreground">Register for an active medical drive to see it here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((reg) => {
            const cfg = reg.drive ? driveTypeConfig(reg.drive.type) : null;
            const statusColor = STATUS_COLOR[reg.status as StatusFilter] ?? 'var(--accent)';
            return (
              <button
                key={reg.id}
                type="button"
                onClick={() => setSelected(reg)}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3.5 text-left shadow-sm transition-colors hover:bg-muted/50">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-bold leading-snug">{reg.drive?.title ?? 'Medical Drive'}</h3>
                  {cfg ? (
                    <span className="shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: `${cfg.color}22`, color: cfg.color }}>
                      {cfg.label}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-primary">{reg.applicant_number}</span>
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-bold capitalize" style={{ backgroundColor: `${statusColor}22`, color: statusColor }}>
                    {reg.status}
                  </span>
                </div>
                {reg.drive ? <p className="text-xs text-muted-foreground">{fmtShortDate(reg.drive.drive_date)} · {reg.drive.location}</p> : null}
              </button>
            );
          })}
        </div>
      )}

      <RegistrationDetailDialog registration={selected} open={selected !== null} onClose={() => setSelected(null)} />
    </div>
  );
}
