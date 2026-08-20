import { CalendarDays, CheckCircle2, MapPin } from 'lucide-react';

import { driveTypeConfig, type MedicalDrive } from '@/hooks/use-medical-drives';

function fmtShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmt12h(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${mStr ?? '00'} ${period}`;
}

/** Web port of mobile's DriveCard — one active/upcoming medical drive. */
export function DriveCard({ drive, isRegistered, onRegister }: { drive: MedicalDrive; isRegistered: boolean; onRegister: () => void }) {
  const cfg = driveTypeConfig(drive.type);
  const fraction = drive.stock_total > 0 ? drive.stock_remaining / drive.stock_total : 0;
  const isFull = drive.stock_remaining <= 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-bold leading-snug">{drive.title}</h3>
        <span
          className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold"
          style={{ backgroundColor: `${cfg.color}22`, color: cfg.color }}>
          {cfg.label}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-semibold text-muted-foreground">
        <CalendarDays size={13} className="text-primary" />
        <span>
          {fmtShortDate(drive.drive_date)} · {fmt12h(drive.time_start)}–{fmt12h(drive.time_end)}
        </span>
        <span className="mx-1 h-1 w-1 rounded-full bg-primary/40" />
        <MapPin size={13} className="text-primary" />
        <span>{drive.location}</span>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">{drive.eligible_criteria}</p>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-1.5">
          <span className="text-sm font-bold">{drive.stock_label}</span>
          <span className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{drive.stock_remaining}</span>/{drive.stock_total} {drive.stock_unit}
          </span>
        </div>

        {isRegistered ? (
          <span className="flex shrink-0 items-center gap-1 rounded-lg bg-primary/15 px-2.5 py-1.5 text-xs font-bold text-primary">
            <CheckCircle2 size={13} /> Registered
          </span>
        ) : (
          <button
            type="button"
            onClick={onRegister}
            disabled={isFull}
            className="shrink-0 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground">
            {isFull ? 'Full' : 'Register'}
          </button>
        )}
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-[#22C55E] transition-all" style={{ width: `${Math.round(fraction * 100)}%` }} />
      </div>
    </div>
  );
}
