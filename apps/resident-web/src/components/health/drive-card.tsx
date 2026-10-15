import { ArrowUpRight, CalendarDays, CheckCircle2, MapPin } from 'lucide-react';
import Link from 'next/link';

import { driveTypeConfig, type MedicalDrive } from '@/hooks/use-medical-drives';

import styles from './health.module.css';

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

/** A scheduled drive with theme-aware availability and the existing registration action.
 * Guests sign in first; full and already-registered drives retain their original gates. */
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
  const fraction = drive.stock_total > 0 ? Math.min(1, Math.max(0, drive.stock_remaining / drive.stock_total)) : 0;
  const isFull = drive.stock_remaining <= 0;

  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <span className={styles.badge}>{cfg.label}</span>
        {isRegistered ? <span className={`${styles.badge} ${styles.badgeAccent}`}><CheckCircle2 size={14} aria-hidden="true" /> Registered</span> : <span className={`${styles.badge} ${!isFull ? styles.badgeAccent : ''}`}>{isFull ? 'Fully booked' : fraction <= 0.2 ? 'Limited availability' : 'Registration open'}</span>}
      </div>
      <h3 className={styles.cardTitle}>{drive.title}</h3>

      <div className={styles.details}>
        <p className={styles.detail}><CalendarDays size={14} aria-hidden="true" />
        <span>
          {fmtShortDate(drive.drive_date)} · {fmt12h(drive.time_start)}–{fmt12h(drive.time_end)}
        </span>
        </p>
        <p className={styles.detail}><MapPin size={14} aria-hidden="true" /><span>{drive.location}</span></p>
      </div>

      <p className={`${styles.criteria} line-clamp-2`}>{drive.eligible_criteria}</p>

      <div className={styles.cardFooter}>
        <div className={styles.stock}>
          <p><strong>{drive.stock_remaining}</strong> / {drive.stock_total} {drive.stock_unit} · {drive.stock_label}</p>
          <div className={styles.stockBar} aria-hidden="true"><div className={styles.stockFill} style={{ width: `${Math.round(fraction * 100)}%` }} /></div>
        </div>

        {isRegistered ? (
          <span className="text-xs text-muted-foreground">You&apos;re registered</span>
        ) : !canRegister && !isFull ? (
          <Link
            href="/login?next=/health"
            className={styles.cta}>
            Log In to Register <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onRegister}
            disabled={isFull}
            className={styles.cta}>
            {isFull ? 'Full' : 'Register'}{!isFull ? <ArrowUpRight size={14} aria-hidden="true" /> : null}
          </button>
        )}
      </div>

    </article>
  );
}
