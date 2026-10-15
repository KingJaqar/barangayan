'use client';

import { Calendar, CheckCircle2, MailOpen, MailX, ArrowUpRight, FileText } from 'lucide-react';
import { incidentStatusMeta } from '@/constants/incident-status';
import { useUnreadCounts } from '@/hooks/use-unread-counts';
import type { MyIncidentRow } from '@/hooks/use-my-incidents';
import { renderIonicon } from '@/lib/ionicon-map';
import styles from './reports.module.css';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function IncidentCard({ incident, selected, onSelect }: { incident: MyIncidentRow; selected: boolean; onSelect: (id: string) => void }) {
  const { markIncidentRead, markIncidentUnread } = useUnreadCounts();
  const meta = incidentStatusMeta(incident.status);
  const category = incident.incident_categories;
  const firstPhoto = incident.photo_urls?.[0] ?? null;
  const isResolved = incident.status === 'resolved';
  const isUnread = isResolved && !incident.resolved_read_at;
  return (
    <article className={styles.card} data-selected={selected || undefined}>
      <button type="button" className={styles.cardMain} onClick={() => onSelect(incident.id)} aria-label={`View report: ${incident.title}`} aria-current={selected ? 'true' : undefined}>
        <span className={styles.cardTop}>
          <span className={styles.category}>
            <span className={styles.categoryIcon} aria-hidden="true">{category ? renderIonicon(category.icon, { size: 18, color: 'currentColor' }) : <FileText size={18} />}</span>
            {category?.name ?? 'Incident report'}
          </span>
          <span className={styles.status} data-status={incident.status}><span aria-hidden="true" />{meta.label}</span>
        </span>
        <span className={styles.cardContent}>
          <span className={styles.cardCopy}>
            <span className={styles.cardTitle}>{incident.title}</span>
            {incident.description && <span className={styles.description}>{incident.description}</span>}
          </span>
          {firstPhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={firstPhoto} alt="" className={styles.thumbnail} />
          )}
        </span>
        <span className={styles.cardFooter}>
          <span className={styles.metadata}>
            <span><Calendar size={13} />{formatDate(incident.created_at)}</span>
            {incident.confirmation_count > 0 && <span><CheckCircle2 size={13} />{incident.confirmation_count}<span className="sr-only">confirmations</span></span>}
          </span>
          <span className={styles.viewReport}>View report<ArrowUpRight size={16} /></span>
        </span>
      </button>
      {isResolved && (
        <div className={styles.readControls}>
          <span className={styles.readLabel}>{isUnread ? 'New update' : 'Update read'}</span>
          <button type="button" aria-label="Mark as read" aria-pressed={!isUnread} onClick={() => { void markIncidentRead(incident.id); }}><MailOpen size={15} /></button>
          <button type="button" aria-label="Mark as unread" aria-pressed={isUnread} onClick={() => { void markIncidentUnread(incident.id); }}><MailX size={15} /></button>
        </div>
      )}
    </article>
  );
}
