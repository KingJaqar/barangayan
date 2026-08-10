'use client';

import type { Tables } from '@barangayan/shared';

type EmergencyQrContent = Tables<'emergency_qr_content'>;

const PHONE_FRAME_CLASSES =
  'rounded-[2rem] border-[6px] border-zinc-900 bg-white shadow-xl dark:border-zinc-100 overflow-hidden';

export function MobilePreviewCard({
  whyScan,
  howItWorks,
}: {
  whyScan: EmergencyQrContent | undefined;
  howItWorks: EmergencyQrContent | undefined;
}) {
  return (
    <div className={PHONE_FRAME_CLASSES}>
      <div className="bg-[#0F6E5B] px-4 py-3">
        <p className="text-center text-sm font-semibold text-white">Mobile Preview</p>
      </div>
      <div className="p-4 space-y-4">
        {[whyScan, howItWorks].filter(Boolean).map((item) => (
          <div
            key={item!.id}
            className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: item!.icon_bg }}>
                <span
                  className="text-xs font-bold"
                  style={{ color: item!.icon_color }}>
                  {item!.icon?.slice(0, 2).toUpperCase() ?? 'QR'}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {item!.title}
                </p>
                <p className="text-xs text-zinc-500 line-clamp-2">{item!.body}</p>
              </div>
            </div>
            <div className="ml-10 space-y-1">
              {(item!.content as unknown as { step: number; title: string; desc: string }[] | undefined)?.map(
                (step, idx) => (
                  <div key={idx} className="flex gap-2 text-xs">
                    <span className="font-bold text-[#0F6E5B]">{step.step}.</span>
                    <div>
                      <p className="font-semibold text-zinc-700 dark:text-zinc-200">{step.title}</p>
                      <p className="text-zinc-500">{step.desc}</p>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        ))}
        {!whyScan && !howItWorks && (
          <p className="text-center text-sm text-zinc-400 py-4">No content configured yet.</p>
        )}
      </div>
    </div>
  );
}
