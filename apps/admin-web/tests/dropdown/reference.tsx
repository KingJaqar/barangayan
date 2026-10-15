import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { ReportSortMenu, type ReportSort } from '../../../resident-web/src/components/reports/report-sort-menu';
import styles from '../../../resident-web/src/components/reports/reports.module.css';
import type { CSSProperties } from 'react';

function Reference() {
  const [value, setValue] = useState<ReportSort>('newest');
  const tokens = { padding: 24, maxWidth: 360, '--card': 'var(--background)', '--popover': 'var(--background)',
    '--popover-foreground': 'var(--foreground)', '--muted': 'color-mix(in srgb, var(--foreground) 5%, var(--background))' } as CSSProperties;
  return <main className={styles.workspace} style={tokens}><h1>Resident Reports reference</h1><ReportSortMenu value={value} onChange={setValue} /></main>;
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<Reference />);
