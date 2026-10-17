'use client';

import { useId, type ReactNode } from 'react';
import { BadgeCheck, ClipboardList, Clock3, HeartPulse, UsersRound, Wallet, type LucideIcon } from 'lucide-react';
import { RECORD_CONFIG, type RecordData } from '@/lib/admin-tables/record-config';
import styles from './operational-record.module.css';

export type OperationalRecordName = 'transactions' | 'health' | 'applicants' | 'staff' | 'households';
export type RecordDetailEntry = readonly [string, string, unknown];
type Section = { title: string; keys: readonly string[] };

const layouts: Record<OperationalRecordName, { label: string; icon: LucideIcon; sections: Section[] }> = {
  transactions: { label: 'Transaction record', icon: Wallet, sections: [
    { title: 'Payment details', keys: ['amount_centavos', 'method', 'status', 'document_fee_centavos', 'paid_at', 'collector_name', 'paymongo_source_id'] },
    { title: 'Service request', keys: ['request_reference', 'resident_name', 'document_name'] },
    { title: 'Refund details', keys: ['refund_status', 'refund_amount_centavos', 'refund_reason', 'refunded_at', 'refund_transfer_link'] },
  ] },
  health: { label: 'Health record', icon: HeartPulse, sections: [
    { title: 'Drive & schedule', keys: ['title', 'type', 'drive_date', 'time_start', 'time_end', 'location', 'is_active'] },
    { title: 'Eligibility', keys: ['eligible_criteria'] },
    { title: 'Stock & registrations', keys: ['stock_label', 'stock_unit', 'stock_total', 'stock_remaining', 'registration_count'] },
  ] },
  applicants: { label: 'Medical applicant record', icon: ClipboardList, sections: [
    { title: 'Registration', keys: ['applicant_number', 'resident_name', 'status', 'priority_score'] },
    { title: 'Medical information', keys: ['age', 'is_pwd', 'comorbidities', 'prior_dose_date'] },
    { title: 'Medical drive', keys: ['drive_title', 'drive_date', 'drive_location'] },
  ] },
  staff: { label: 'Staff member record', icon: BadgeCheck, sections: [
    { title: 'Contact details', keys: ['full_name', 'email', 'mobile_number', 'home_address'] },
    { title: 'Staff assignment', keys: ['official_role', 'date_hired', 'is_active'] },
  ] },
  households: { label: 'Household member record', icon: UsersRound, sections: [
    { title: 'Household membership', keys: ['name', 'resident_name', 'relation', 'role'] },
    { title: 'Evacuation check-in', keys: ['is_checked_in', 'checked_in_at', 'checked_in_center_name'] },
  ] },
};
const history: Section = { title: 'Record history', keys: ['created_at', 'updated_at'] };
const wideFields = new Set(['eligible_criteria', 'refund_reason', 'refund_transfer_link', 'home_address', 'location', 'drive_location', 'comorbidities', 'paymongo_source_id']);
const importantFields = new Set(['status', 'refund_status', 'drive_date', 'drive_location', 'location', 'is_checked_in', 'checked_in_center_name', 'official_role', 'mobile_number', 'age', 'is_pwd']);
const dateFields = new Set(['drive_date', 'prior_dose_date', 'date_hired']);
const timestampFields = new Set(['created_at', 'updated_at', 'paid_at', 'refunded_at', 'checked_in_at']);
const dateFormatter = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' });
const timestampFormatter = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });

export function isOperationalRecord(name: string): name is OperationalRecordName {
  return Object.hasOwn(layouts, name);
}
export function operationalRecordLabel(name: OperationalRecordName) { return layouts[name].label; }

function readable(value: unknown) {
  return String(value ?? '').replaceAll('_', ' ').replace(/^\w/, char => char.toUpperCase());
}

/** Presentation only: all values come from the existing record read and field configuration. */
export function OperationalRecordDetails({ name, row, entries, renderValue }: {
  name: OperationalRecordName; row: RecordData; entries: readonly RecordDetailEntry[];
  renderValue: (value: unknown) => ReactNode;
}) {
  const id = useId();
  const layout = layouts[name];
  const Icon = layout.icon;
  const sections = [...layout.sections, history];
  const values = new Map(entries.map(([key, , value]) => [key, value]));
  const get = (key: string) => values.get(key);
  function display(key: string, value: unknown) {
    const field = RECORD_CONFIG[name].fields.find(item => item.key === key);
    const option = field?.options?.find(item => item.value === value);
    if (key === 'method') return value === 'qrph' ? 'QR Ph' : value === 'pickup' ? 'Pay at pickup' : readable(value) || null;
    if (option) return readable(option.label);
    if (key === 'refund_status' || key === 'relation' || key === 'role') return readable(value) || null;
    if (dateFields.has(key) && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)))
      return dateFormatter.format(new Date(`${value}T00:00:00+08:00`));
    if (timestampFields.has(key) && typeof value === 'string' && !Number.isNaN(Date.parse(value))) return timestampFormatter.format(new Date(value));
    if ((key === 'time_start' || key === 'time_end') && typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)) {
      const [hour, minute] = value.split(':');
      return `${Number(hour) % 12 || 12}:${minute} ${Number(hour) >= 12 ? 'PM' : 'AM'}`;
    }
    return value;
  }
  const title = name === 'transactions' || name === 'applicants' ? get('resident_name')
    : name === 'staff' ? get('full_name') : name === 'households' ? get('name') : get('title');
  const subtitle = name === 'transactions' ? get('document_name') : name === 'applicants' ? get('drive_title')
    : name === 'staff' ? get('email') : name === 'households' ? get('resident_name') : get('location');
  const badges = name === 'transactions' ? [['status', get('status')], ['method', get('method')]]
    : name === 'health' ? [['is_active', typeof row.is_active === 'boolean' ? row.is_active ? 'Active' : 'Inactive' : null], ['type', get('type')]]
    : name === 'staff' ? [['is_active', typeof row.is_active === 'boolean' ? row.is_active ? 'Active' : 'Inactive' : null], ['official_role', get('official_role')]]
    : name === 'households' ? [['role', get('role')], ['relation', get('relation')]] : [['status', get('status')]];
  const metrics = name === 'transactions' ? [['amount_centavos', 'Payment amount'], ['document_fee_centavos', 'Document fee']]
    : name === 'health' ? [['stock_remaining', 'Remaining stock'], ['stock_total', 'Total stock'], ['registration_count', 'Registrations']] : [];
  return <article className={styles.record}>
    <header className={styles.hero}>
      <p className={styles.eyebrow}><Icon size={14} aria-hidden="true" />{layout.label}</p>
      <h3 className={styles.title}>{String(title || (name === 'applicants' ? get('applicant_number') : null) || layout.label)}</h3>
      {subtitle ? <p className={styles.subtitle}>{name === 'households' ? 'Head of household · ' : ''}{String(subtitle)}</p> : null}
      <div className={styles.badges}>
        {badges.filter(([, value]) => value !== null && value !== undefined && value !== '').map(([key, value], index) => <span key={String(key)} className={index === 0 ? styles.status : styles.badge}>
          {index === 0 && <span aria-hidden="true" className={styles.dot} />}{String(display(String(key), value))}
        </span>)}
        {name === 'applicants' && get('applicant_number') ? <span className={styles.badge}>{String(get('applicant_number'))}</span> : null}
        {name === 'transactions' && get('request_reference') ? <span className={styles.badge}>{String(get('request_reference'))}</span> : null}
      </div>
      {metrics.length > 0 && <dl className={styles.metrics}>{metrics.map(([key, label]) => <div key={key}>
        <dt>{label}</dt><dd>{renderValue(get(key))}</dd>
      </div>)}</dl>}
    </header>
    <nav className={styles.navigation} aria-label={`${layout.label} sections`}>
      {sections.map((section, index) => <a key={section.title} href={`#${id}-${index}`}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{section.title}</a>)}
    </nav>
    {sections.map((section, index) => <section key={section.title} id={`${id}-${index}`} className={styles.section} aria-labelledby={`${id}-${index}-heading`}>
      <h4 id={`${id}-${index}-heading`} className={styles.heading}><span>{String(index + 1).padStart(2, '0')}</span>{section.title}
        {section === history ? <Clock3 size={16} aria-hidden="true" /> : null}
      </h4>
      <dl className={styles.details}>{section.keys.map(key => {
        const entry = entries.find(([entryKey]) => entryKey === key);
        if (!entry) return null;
        const [, label, value] = entry;
        return <div key={key} className={`${wideFields.has(key) ? styles.wide : ''} ${importantFields.has(key) ? styles.important : ''}`}>
          <dt>{key === 'amount_centavos' ? 'Payment amount' : key === 'comorbidities' ? 'Comorbidities' : label}</dt>
          <dd>{renderValue(display(key, value))}</dd>
        </div>;
      })}</dl>
    </section>)}
  </article>;
}
