'use client';

import { CheckSquare, QrCode } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { AuthGate } from '@/components/shared/auth-gate';
import { QrScannerDialog } from '@/components/emergency/qr-scanner-dialog';
import { QrShowDialog } from '@/components/emergency/qr-show-dialog';
import { QrUploadFallback } from '@/components/emergency/qr-upload-fallback';
import { EmergencyPageHeader } from '@/components/emergency/emergency-page-header';
import { InlineReadError } from '@/components/shared/inline-read-error';
import { LoadingStatus } from '@/components/shared/loading-status';
import { Skeleton } from '@/components/ui/loading';
import { useEmergencyQrContent } from '@/hooks/use-emergency-qr-content';
import { useEvacuationCenters } from '@/hooks/use-evacuation-centers';
import { renderIonicon } from '@/lib/ionicon-map';
import styles from './emergency.module.css';

/** Web port of qr-guide-content.tsx — instructional "Why Scan" / "How It Works" cards
 * [C-014] plus Scan/Show entry points [C-011, C-012]. Guests see EmergencyAuthGate
 * instead — see emergency/scan/page.tsx's doc comment. */
export function ScanContent({ userId, barangayId }: { userId: string | null; barangayId: string | null }) {
  const { content, isInitialLoading, isReady, error, errorAnnounced, refetch } = useEmergencyQrContent(barangayId);
  const centersRead = useEvacuationCenters({ barangayId });
  const [showScanner, setShowScanner] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (!userId || !barangayId) {
    return (
      <AuthGate
        title="Log In to Use QR Check-In"
        description="Log in to show your Family QR to barangay staff. Staff confirm who is present at an evacuation center."
        next="/emergency/scan"
      />
    );
  }

  const whyScan = content.find((c) => c.section === 'why_scan');
  const howItWorks = content.find((c) => c.section === 'how_it_works');
  const steps = (howItWorks?.content as unknown as { step: number; title: string; desc: string }[] | undefined) ?? [];

  return (
    <div className={styles.content}>
      <EmergencyPageHeader title="QR Check-In Guide" />
      <p className={styles.sectionDescription}>Show your Family QR to barangay staff and confirm who is present. Scanning a center code does not record attendance.</p>

      {isInitialLoading ? (
        <div aria-busy className="flex flex-col gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : !isReady ? (
        <InlineReadError announce={!errorAnnounced} message="We couldn't load the check-in instructions. You can still scan or show a QR code below." onRetry={() => refetch('check-in instructions')} />
      ) : (
        <>
          {whyScan ? (
            <div className={styles.whyScan}>
              <span className={styles.qrIcon}>
                {renderIonicon(whyScan.icon ?? 'qr-code-outline', { size: 26, strokeWidth: 1.75 })}
              </span>
              <div>
                <p className="font-semibold">
                  {whyScan.title}
                </p>
                <p className={styles.sectionDescription}>
                  {whyScan.body}
                </p>
              </div>
            </div>
          ) : null}

          {howItWorks ? (
            <section className={styles.panel}>
              <p className={styles.sectionNumber}>YOUR CHECK-IN, STEP BY STEP</p>
              <div className={styles.panelHeading}>
                <div>
                  <h2>{howItWorks.title}</h2>
                  <p className={styles.sectionDescription}>{howItWorks.body}</p>
                </div>
              </div>
              <div className={styles.steps}>
                {steps.map((step, idx) => (
                  <div key={idx} className={styles.step}>
                    <span className={styles.stepNumber}>{String(step.step).padStart(2, '0')}</span>
                    <div>
                      <p className={styles.stepTitle}>{step.title}</p>
                      <p className={styles.stepDescription}>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      {isReady && error ? (
        <InlineReadError announce={!errorAnnounced}
          tone="warning"
          message="Couldn't update the instructions. Showing the last loaded version."
          onRetry={() => refetch('check-in instructions')}
        />
      ) : null}
      <LoadingStatus active={isInitialLoading} label="Loading check-in instructions…" />

      <section className={styles.actionPanel}>
        <div className={styles.actionCopy}>
          <h2>Ready to check in?</h2>
          <p className={styles.sectionDescription}>Scan or display a check-in QR code.</p>
        </div>
        <div className={styles.actionButtons}>
          <Button type="button" className={styles.primaryButton} onClick={() => setShowScanner(true)}>
            <QrCode size={20} /> Scan QR
          </Button>
          <Button type="button" variant="outline" className={styles.secondaryButton} onClick={() => setShowQr(true)}>
            <CheckSquare size={20} /> Show QR
          </Button>
        </div>
      </section>

      <QrUploadFallback userId={userId} barangayId={barangayId} userBarangayId={barangayId} />

      <QrScannerDialog open={showScanner} onClose={() => setShowScanner(false)} userId={userId} barangayId={barangayId} userBarangayId={barangayId} />
      <QrShowDialog open={showQr} onClose={() => setShowQr(false)} centers={centersRead.centers}
        barangayId={barangayId}
        centersStatus={centersRead.isInitialLoading ? 'loading' : centersRead.isReady ? 'ready' : 'error'}
        onRetryCenters={() => centersRead.refetch('evacuation centers')}
      />
    </div>
  );
}
