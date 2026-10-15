import { Phone } from 'lucide-react';

import { renderIonicon } from '@/lib/ionicon-map';
import styles from './emergency.module.css';

/** Web port of the hotline row rendered inline in mobile's HubContent — a `tel:` link
 * per number so a click-to-call works on any device with a phone app registered. */
export function HotlineRow({
  name,
  numbers,
  icon,
}: {
  name: string;
  numbers: { label: string; number: string }[];
  icon: string | null;
  iconColor: string | null;
  iconBg: string | null;
}) {
  return (
    <div className={styles.hotlineRow}>
      <span
        className={styles.rowIcon}>
        {renderIonicon(icon, { size: 20, strokeWidth: 1.75 })}
      </span>
      <div className={styles.hotlineInfo}>
        <p className="text-sm font-semibold">{name}</p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          {numbers.map((n) => (
            <a
              key={n.number}
              href={`tel:${n.number}`}
              className={styles.phoneLink}>
              <Phone size={12} strokeWidth={2} />
              {n.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
