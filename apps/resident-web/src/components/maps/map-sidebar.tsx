import { ArrowUpRight, BookOpen, Building2, Megaphone, Phone, Plus, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import styles from './maps.module.css';

/**
 * Sidebar of Emergency/DRRM + reporting shortcuts, occupying the unused space beside
 * the map on wide viewports (previously a horizontal panel below the map — moved here
 * per request, so the map itself gets the full column width). Falls below the map in
 * the page's single-column grid on narrow viewports rather than disappearing.
 *
 * Deep-links into the Emergency & DRRM section and incident reporting (per the plan's
 * file-tree note "map-bottom-panel.tsx links into /emergency/*") plus the two Maps
 * sub-pages (Directory, Preparedness), which have no other nav entry point.
 */
export function MapSidebar() {
  const links = [
    { href: '/emergency', label: 'Emergency Hub', description: 'Find help and safety information', icon: ShieldAlert },
    { href: '/emergency/centers', label: 'Evacuation Centers', description: 'Explore places to stay safe', icon: Building2 },
    { href: '/emergency/alerts', label: 'Emergency Alerts', description: 'Read the latest advisories', icon: Megaphone },
    { href: '/maps/directory', label: 'Directory', description: 'Keep important contacts close', icon: Phone },
    { href: '/maps/preparedness', label: 'Preparedness Guide', description: 'Be ready before an emergency', icon: BookOpen },
  ] as const;

  return (
    <aside className={styles.sidebar} aria-label="Emergency and community resources">
      <Link href="/reports/new" className={styles.reportLink}>
        <Plus size={18} aria-hidden /> Report an incident <ArrowUpRight size={16} aria-hidden />
      </Link>
      <nav className={styles.resourceLinks} aria-label="Map resources">
        {links.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={styles.resourceLink}>
            <span className={styles.resourceIcon}>
              <Icon size={19} strokeWidth={1.65} aria-hidden />
            </span>
            <span className={styles.resourceCopy}><span>{label}</span><small>{description}</small></span>
            <ArrowUpRight size={14} className={styles.resourceArrow} aria-hidden />
          </Link>
        ))}
      </nav>
    </aside>
  );
}
