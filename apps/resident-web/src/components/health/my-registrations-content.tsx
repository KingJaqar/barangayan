'use client';

import { ArrowRight, CalendarDays, ClipboardList, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { RegistrationDrawer } from '@/components/health/registration-drawer';
import { driveTypeConfig, useMedicalDrives, type DriveRegistrationRow } from '@/hooks/use-medical-drives';

import styles from './health.module.css';
import stickyStyles from '@/components/shared/sticky-tabs.module.css';

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'attended' | 'cancelled';

const STATUS_KEYS: StatusFilter[] = ['all', 'pending', 'confirmed', 'attended', 'cancelled'];

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
      className={`${styles.page} ${drawerOpen ? styles.drawerOpen : ''}`}>
      <div className={`${styles.filters} ${styles.registrationFilters} ${stickyStyles.secondary}`} role="group" aria-label="Filter registrations by status">
        {STATUS_KEYS.map((key) => {
          const isActive = statusFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              aria-pressed={isActive}
              className={`${styles.filter} capitalize`}>
              {key === 'all' ? 'All registrations' : key}
              {!loadingRegistrations ? <span className={styles.filterCount}>{key === 'all' ? myRegistrations.length : myRegistrations.filter((reg) => reg.status === key).length}</span> : null}
            </button>
          );
        })}
      </div>
      <div className={styles.resultsHeader}>
        <h2 className={styles.dateTitle}>{statusFilter === 'all' ? 'Your registrations' : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} registrations`}</h2>
        <p className={styles.resultCount} role="status">{loadingRegistrations ? 'Loading registrations…' : `${filtered.length} ${filtered.length === 1 ? 'registration' : 'registrations'}`}</p>
      </div>

      {loadingRegistrations ? (
        <div className={styles.registrationGrid} aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className={`${styles.skeleton} rw-skeleton`} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <ClipboardList size={24} aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2>{statusFilter === 'all' ? 'No registrations yet' : `No ${statusFilter} registrations`}</h2>
            <p>{statusFilter === 'all' ? 'Find an active medical drive and register. Your application will appear here.' : 'Choose another status to see your other applications.'}</p>
          </div>
          {statusFilter === 'all' ? <Link href="/health" className={styles.cta}>Explore active drives <ArrowRight size={14} aria-hidden="true" /></Link> : <button type="button" className={styles.filter} onClick={() => setStatusFilter('all')}>View all registrations</button>}
        </div>
      ) : (
        // Multi-column when nothing is selected, forced back to a single column once the
        // drawer opens — same reflow as reports/incident-drawer.tsx's IncidentList.
        <div className={styles.registrationGrid}>
          {filtered.map((reg: DriveRegistrationRow) => {
            const cfg = reg.drive ? driveTypeConfig(reg.drive.type) : null;
            const isSelected = reg.id === selectedId;
            return (
              <button
                key={reg.id}
                type="button"
                aria-current={isSelected ? 'true' : undefined}
                onClick={() => setSelectedId(reg.id)}
                className={`${styles.card} ${styles.registration}`}>
                <div className={styles.cardTop}>
                  {cfg ? (
                    <span className={styles.badge}>
                      {cfg.label}
                    </span>
                  ) : null}
                  <span className={`${styles.badge} ${styles.badgeAccent} capitalize`}>
                    {reg.status}
                  </span>
                </div>
                <h3 className={styles.cardTitle}>{reg.drive?.title ?? 'Medical Drive'}</h3>
                {reg.drive ? <div className={styles.details}><p className={styles.detail}><CalendarDays size={14} aria-hidden="true" />{fmtShortDate(reg.drive.drive_date)}</p><p className={styles.detail}><MapPin size={14} aria-hidden="true" /><span>{reg.drive.location}</span></p></div> : null}
                <div className={styles.registrationFooter}><span className={styles.number}>{reg.applicant_number}</span><span className="flex items-center gap-2">View details <ArrowRight size={14} aria-hidden="true" /></span></div>
              </button>
            );
          })}
        </div>
      )}

      <RegistrationDrawer registration={selected} open={drawerOpen} onClose={() => setSelectedId(null)} />
    </div>
  );
}
