'use client';

import { QrCode } from 'lucide-react';
import { SELECT_OPTION_ICONS } from '@/components/admin/dropdown/select-iconography';
import styles from './emergency-qr.module.css';
import type { Tables } from '@barangayan/shared';

type EmergencyQrContent = Tables<'emergency_qr_content'>;

export function MobilePreviewCard({
  whyScan,
  howItWorks,
}: {
  whyScan: EmergencyQrContent | undefined;
  howItWorks: EmergencyQrContent | undefined;
}) {
  return (
    <div className={styles.phone}>
      <div className={styles.phoneBar}><span /><span>Barangayan</span><QrCode size={14} aria-hidden="true" /></div>
      <div className={styles.phoneScreen}>
        <p className={styles.eyebrow}>Emergency QR</p>
        <h3>Check in with confidence.</h3>
        <p className={styles.phoneIntro}>Your guide to a safe arrival.</p>
        {[whyScan, howItWorks].filter((item): item is EmergencyQrContent => !!item).map((item) => {
          const icons = SELECT_OPTION_ICONS.qrIcon;
          const Icon = icons && item.icon && Object.hasOwn(icons, item.icon) ? icons[item.icon] : QrCode;
          return (
            <div key={item.id} className={styles.phoneCard}>
              <div className={styles.phoneCardHeading}>
                <span className={styles.phoneIcon} style={{ backgroundColor: item.icon_bg ?? undefined, color: item.icon_color ?? undefined }}>
                  <Icon size={17} aria-hidden="true" />
                </span>
                <h4>{item.title}</h4>
              </div>
              <p>{item.body}</p>
              <div className={styles.previewSteps}>
                {(Array.isArray(item.content) ? item.content as unknown as { step: number; title: string; desc: string }[] : []).map((step, idx) => (
                  <div key={idx} className={styles.previewStep}>
                    <span>{step.step}</span>
                    <div><h5>{step.title}</h5><p>{step.desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {!whyScan && !howItWorks && <p className={styles.previewEmpty}>No content configured yet.</p>}
      </div>
      <div className={styles.phoneBottom}><span /></div>
    </div>
  );
}
