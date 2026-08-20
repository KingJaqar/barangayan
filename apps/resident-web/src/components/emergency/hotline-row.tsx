import { Phone } from 'lucide-react';

import { renderIonicon } from '@/lib/ionicon-map';

/** Web port of the hotline row rendered inline in mobile's HubContent — a `tel:` link
 * per number so a click-to-call works on any device with a phone app registered. */
export function HotlineRow({
  name,
  numbers,
  icon,
  iconColor,
  iconBg,
}: {
  name: string;
  numbers: { label: string; number: string }[];
  icon: string | null;
  iconColor: string | null;
  iconBg: string | null;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: iconBg ?? undefined, color: iconColor ?? undefined }}>
        {renderIonicon(icon, { size: 20, strokeWidth: 1.75 })}
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold">{name}</p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          {numbers.map((n) => (
            <a
              key={n.number}
              href={`tel:${n.number}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <Phone size={12} strokeWidth={2} />
              {n.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
