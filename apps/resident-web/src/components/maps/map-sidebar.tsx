import { BookOpen, Megaphone, Phone, ShieldAlert, TriangleAlert } from 'lucide-react';
import Link from 'next/link';

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
    { href: '/emergency', label: 'Emergency Hub', icon: ShieldAlert },
    { href: '/emergency/centers', label: 'Evacuation Centers', icon: ShieldAlert },
    { href: '/reports/new', label: 'Report an Incident', icon: TriangleAlert },
    { href: '/emergency/alerts', label: 'Emergency Alerts', icon: Megaphone },
    { href: '/maps/directory', label: 'Directory', icon: Phone },
    { href: '/maps/preparedness', label: 'Preparedness Guide', icon: BookOpen },
  ] as const;

  return (
    <aside className="flex h-[calc(100vh-220px)] min-h-[480px] flex-col gap-2 overflow-y-auto rounded-2xl border border-border bg-card p-3">
      <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Emergency & Reports</p>
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-border hover:bg-muted">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Icon size={18} strokeWidth={1.75} />
          </span>
          <span className="text-sm font-semibold">{label}</span>
        </Link>
      ))}
    </aside>
  );
}
