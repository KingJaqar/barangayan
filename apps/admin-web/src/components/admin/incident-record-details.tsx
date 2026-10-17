'use client';

import { useId, useState } from 'react';
import { ArrowUpRight, Camera, Clock3, MapPin, Users, UserRound } from 'lucide-react';
import type { RecordData } from '@/lib/admin-tables/record-config';
import styles from './incident-record.module.css';

const text = (value: unknown, fallback = 'Not provided') => typeof value === 'string' && value.trim() ? value : fallback;
function timestamp(value: unknown) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return 'Not available';
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value));
}

/** Presentation of the existing incident record; reads and mutations stay in RecordSheet. */
export function IncidentRecordDetails({ row }: { row: RecordData }) {
  const id = useId();
  const [selected, setSelected] = useState(0);
  const profile = (row.profile ?? row.profiles) as Record<string, unknown> | null;
  const category = row.incident_categories as Record<string, unknown> | null;
  const location = row.location as Record<string, unknown> | null;
  const photos = Array.isArray(row.photo_urls) ? row.photo_urls.filter((url): url is string => typeof url === 'string' && /^https?:\/\//i.test(url)) : [];
  const activePhoto = Math.min(selected, Math.max(0, photos.length - 1));
  const confirmations = typeof row.confirmation_count === 'number' ? row.confirmation_count : 0;
  const status = text(row.status, 'Not available').replaceAll('_', ' ');
  const coordinates = location && typeof location.lat === 'number' && Number.isFinite(location.lat) && typeof location.lng === 'number' && Number.isFinite(location.lng)
    ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : 'No map pin provided';

  return <article className={styles.report}>
    <header className={styles.hero}>
      <p className={styles.eyebrow}>Incident report</p>
      <h3 className={styles.title}>{text(row.title, 'Untitled incident')}</h3>
      <div className={styles.badges}>
        <span className={styles.status}><span aria-hidden="true" />{status}</span>
        <span className={styles.badge}>{text(category?.name, 'Uncategorized')}</span>
      </div>
      <div className={styles.summary}>
        <span><Clock3 size={14} aria-hidden="true" />{timestamp(row.created_at)}</span>
        <span><Users size={14} aria-hidden="true" />{confirmations} resident confirmation{confirmations === 1 ? '' : 's'}</span>
      </div>
    </header>
    <nav className={styles.navigation} aria-label="Incident report sections">
      <a href={`#${id}-overview`}>Overview</a>
      <a href={`#${id}-photos`}>Photos <span>{photos.length}</span></a>
      <a href={`#${id}-location`}>Location</a>
      <a href={`#${id}-reporter`}>Reporter</a>
    </nav>
    <section id={`${id}-overview`} className={styles.section}>
      <h4 className={styles.heading}><span className={styles.number}>01</span>Report overview</h4>
      <p className={styles.description}>{text(row.description, 'No description provided.')}</p>
    </section>
    <section id={`${id}-photos`} className={styles.section}>
      <h4 className={styles.heading}><span className={styles.number}>02</span>Photos<span className={styles.count}>{photos.length} attached</span></h4>
      {photos.length ? <div className={styles.gallery}>
        <figure>
          <div className={styles.photoStage}>
            {/* Resident uploads have environment-specific hosts; preserve direct attachment URLs. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={photos[activePhoto]} src={photos[activePhoto]} alt={`Incident photo ${activePhoto + 1}`} className={styles.photo} />
          </div>
          <figcaption><span aria-live="polite">Photo {activePhoto + 1} of {photos.length}</span><a href={photos[activePhoto]} target="_blank" rel="noopener noreferrer">Open original <ArrowUpRight size={14} aria-hidden="true" /></a></figcaption>
        </figure>
        {photos.length > 1 && <div className={styles.thumbnails} role="group" aria-label="Incident photos">
          {photos.map((url, index) => <button type="button" key={`${url}-${index}`} onClick={() => setSelected(index)} aria-label={`View photo ${index + 1}`} aria-pressed={activePhoto === index}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" loading="lazy" />
            <span>{String(index + 1).padStart(2, '0')}</span>
          </button>)}
        </div>}
      </div> : <div className={styles.empty}><Camera size={22} strokeWidth={1.5} aria-hidden="true" /><div><p>No photos attached</p><span>This report was submitted without photos.</span></div></div>}
    </section>
    <section id={`${id}-location`} className={styles.section}>
      <h4 className={styles.heading}><span className={styles.number}>03</span>Location<MapPin size={16} aria-hidden="true" /></h4>
      <dl className={styles.details}>
        <div className={styles.wide}><dt>Address</dt><dd>{text(row.address)}</dd></div>
        <div><dt>Specific area details</dt><dd>{text(row.specific_area_details)}</dd></div>
        <div><dt>Coordinates</dt><dd className={styles.coordinates}>{coordinates}</dd></div>
      </dl>
    </section>
    <section id={`${id}-reporter`} className={styles.section}>
      <h4 className={styles.heading}><span className={styles.number}>04</span>Reported by<UserRound size={16} aria-hidden="true" /></h4>
      <p className={styles.reporter}>{text(profile?.full_name, 'Anonymous report')}</p>
    </section>
  </article>;
}
