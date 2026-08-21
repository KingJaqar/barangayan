import { CalendarDays, CheckCircle2, MapPin } from 'lucide-react';
import Link from 'next/link';

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

/** One active/upcoming medical drive — styled to match the reports IncidentCard's web
 * card language (soft border, shadow-sm -> shadow-md on hover) instead of mobile's
 * heavier rounded-2xl/border-only look. `canRegister` is false for guests — registering
 * needs a real account (drive_registrations has no anon insert policy), so their CTA
 * reads "Log In to Register" and links out instead of opening RegisterDrawer, same
 * "Log In to Request" branch as the Documents catalog's DetailsStep. */
export function DriveCard({
  drive,
  isRegistered,
  canRegister,
  onRegister,
}: {
  drive: MedicalDrive;
  isRegistered: boolean;
  canRegister: boolean;
  onRegister: () => void;
}) {
  const cfg = driveTypeConfig(drive.type);
  const fraction = drive.stock_total > 0 ? drive.stock_remaining / drive.stock_total : 0;
  const isFull = drive.stock_remaining <= 0;
  const stockColor = fraction <= 0.2 ? '#EF4444' : fraction <= 0.5 ? '#F59E0B' : '#22C55E';

  return (
    <div className="flex flex-col rounded-xl border border-black/8 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-white/8 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-bold leading-snug">{drive.title}</h3>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ backgroundColor: `${cfg.color}1a`, color: cfg.color }}>
          {cfg.label}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
        <CalendarDays size={12} />
        <span>
          {fmtShortDate(drive.drive_date)} · {fmt12h(drive.time_start)}–{fmt12h(drive.time_end)}
        </span>
        <span className="mx-0.5 h-1 w-1 rounded-full bg-muted-foreground/40" />
        <MapPin size={12} />
        <span className="truncate">{drive.location}</span>
      </div>

      <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{drive.eligible_criteria}</p>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-1.5">
          <span className="text-xs font-semibold text-foreground">{drive.stock_label}</span>
          <span className="text-xs text-muted-foreground">
            <span className="font-bold text-foreground">{drive.stock_remaining}</span>/{drive.stock_total} {drive.stock_unit}
          </span>
        </div>

        {isRegistered ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary">
            <CheckCircle2 size={13} /> Registered
          </span>
        ) : !canRegister && !isFull ? (
          <Link
            href="/login?next=/health"
            className="shrink-0 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            Log In to Register
          </Link>
        ) : (
          <button
            type="button"
            onClick={onRegister}
            disabled={isFull}
            className="shrink-0 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground">
            {isFull ? 'Full' : 'Register'}
          </button>
        )}
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(fraction * 100)}%`, backgroundColor: stockColor }} />
      </div>
    </div>
  );
}
