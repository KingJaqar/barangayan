import Link from 'next/link';
import { type LucideIcon } from 'lucide-react';
import styles from './home.module.css';

export function QuickActionTile({ href, icon: Icon, label, description }: { href: string; icon: LucideIcon; label: string; description: string }) {
  return (
    <Link
      href={href}
      title={description}
      className={styles.action}>
      <div className={styles.actionIcon}>
        <Icon aria-hidden size={21} strokeWidth={1.75} />
      </div>
      <p className={styles.actionTitle}>{label}</p>
      <p className="sr-only">{description}</p>
    </Link>
  );
}
