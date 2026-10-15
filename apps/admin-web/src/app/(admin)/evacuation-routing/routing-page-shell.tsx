import { Route } from 'lucide-react';
import type { ReactNode } from 'react';

import styles from './routing.module.css';

export function RoutingPageShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}><Route size={15} aria-hidden="true" /> Disaster preparedness / DRRM</p>
        <h1 className="sr-only">Evacuation routing</h1>
      </header>
      {children}
    </div>
  );
}
