'use client';

import { Inbox, Search, X } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import styles from './content-workspace.module.css';

export function ContentSummary({ items }: { items: { label: string; value: number; detail: string }[] }) {
  return <dl className={styles.summary}>
    {items.map(item => <div key={item.label} className={styles.summaryItem}>
      <dt>{item.label}</dt><dd>{item.value.toLocaleString()}</dd><p>{item.detail}</p>
    </div>)}
  </dl>;
}

export function ContentSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const id = useId();
  return <section className={styles.section} aria-labelledby={id}>
    <div className={styles.sectionHeader}><div><h2 id={id}>{title}</h2><p>{description}</p></div></div>
    {children}
  </section>;
}

export function ContentFilters<T extends string>({ label, options, value, onChange }: {
  label: string; options: { value: T; label: string; count?: number }[]; value: T; onChange: (value: T) => void;
}) {
  return <div className={styles.filters} role="group" aria-label={label}>
    {options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value}
      className={styles.filter} onClick={() => onChange(option.value)}>
      {option.label}{option.count !== undefined ? <span>{option.count}</span> : null}
    </button>)}
  </div>;
}

export function ContentToolbar({ label, query, onQueryChange, placeholder, children }: {
  label: string; query: string; onQueryChange: (query: string) => void; placeholder: string; children?: ReactNode;
}) {
  return <div className={styles.toolbar}>
    <div className={styles.search}><Search size={17} aria-hidden="true" />
      <input aria-label={label} type="search" value={query} onChange={event => onQueryChange(event.target.value)} placeholder={placeholder} />
      {query ? <button type="button" onClick={() => onQueryChange('')} aria-label={`Clear ${label.toLowerCase()}`}><X size={15} aria-hidden="true" /></button> : null}
    </div>{children}
  </div>;
}

export function ContentResults({ count, total, noun, filtered, onReset }: {
  count: number; total: number; noun: string; filtered: boolean; onReset: () => void;
}) {
  return <div className={styles.results}><p role="status" aria-live="polite">{count} of {total} {noun}</p>
    {filtered ? <button type="button" onClick={onReset}>Reset filters</button> : null}
  </div>;
}

export function ContentEmptyState({ title, description, onReset }: { title: string; description: string; onReset?: () => void }) {
  return <div className={styles.empty}><span className={styles.emptyIcon}><Inbox size={24} aria-hidden="true" /></span>
    <h3>{title}</h3><p>{description}</p>{onReset ? <button type="button" onClick={onReset}>Clear filters</button> : null}
  </div>;
}

export function ContentStatus({ active, activeLabel = 'Active', inactiveLabel = 'Inactive' }: {
  active: boolean; activeLabel?: string; inactiveLabel?: string;
}) {
  return <span className={`${styles.status} ${active ? styles.activeStatus : ''}`}><span aria-hidden="true" />{active ? activeLabel : inactiveLabel}</span>;
}
