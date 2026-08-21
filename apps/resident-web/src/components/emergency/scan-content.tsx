'use client';

import { CheckSquare, QrCode } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { AuthGate } from '@/components/shared/auth-gate';
import { QrScannerDialog } from '@/components/emergency/qr-scanner-dialog';
import { QrShowDialog } from '@/components/emergency/qr-show-dialog';
import { QrUploadFallback } from '@/components/emergency/qr-upload-fallback';
import { useEmergencyQrContent } from '@/hooks/use-emergency-qr-content';
import { useEvacuationCenters } from '@/hooks/use-evacuation-centers';
import { renderIonicon } from '@/lib/ionicon-map';

/** Web port of qr-guide-content.tsx — instructional "Why Scan" / "How It Works" cards
 * [C-014] plus Scan/Show entry points [C-011, C-012]. Guests see EmergencyAuthGate
 * instead — see emergency/scan/page.tsx's doc comment. */
export function ScanContent({ userId, barangayId }: { userId: string | null; barangayId: string | null }) {
  const { content, isLoading, error } = useEmergencyQrContent(barangayId);
  const { centers } = useEvacuationCenters({ barangayId });
  const [showScanner, setShowScanner] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (!userId || !barangayId) {
    return (
      <AuthGate
        title="Log In to Use QR Check-In"
        description="QR check-in registers your presence at an evacuation center, so it needs a real account. Log in or create one to scan or show your QR code."
        next="/emergency/scan"
      />
    );
  }

  const whyScan = content.find((c) => c.section === 'why_scan');
  const howItWorks = content.find((c) => c.section === 'how_it_works');
  const steps = (howItWorks?.content as unknown as { step: number; title: string; desc: string }[] | undefined) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-primary">QR Check-In Guide</h1>
        <p className="text-sm text-muted-foreground">Follow these quick steps to register your presence securely.</p>
      </div>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      ) : error ? (
        <p className="text-sm text-muted-foreground">Unable to load instructions.</p>
      ) : (
        <>
          {whyScan ? (
            <div className="flex items-start gap-3 rounded-2xl border p-4" style={{ backgroundColor: whyScan.icon_bg ?? '#FEF9E7', borderColor: '#F3E8C7' }}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: whyScan.icon_bg ?? '#FEF9E7', color: whyScan.icon_color ?? undefined }}>
                {renderIonicon(whyScan.icon ?? 'qr-code-outline', { size: 26, strokeWidth: 1.75 })}
              </span>
              <div>
                <p className="font-bold" style={{ color: '#1F2937' }}>
                  {whyScan.title}
                </p>
                <p className="mt-1 text-sm" style={{ color: '#4B5563' }}>
                  {whyScan.body}
                </p>
              </div>
            </div>
          ) : null}

          {howItWorks ? (
            <div>
              <h2 className="font-bold">{howItWorks.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{howItWorks.body}</p>
              <div className="mt-4 flex flex-col gap-4">
                {steps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{step.step}</span>
                      {idx < steps.length - 1 ? <span className="mt-1 h-full w-0.5 flex-1 bg-primary/30" /> : null}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-bold">{step.title}</p>
                      <p className="text-sm text-muted-foreground">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" className="flex-1" onClick={() => setShowScanner(true)}>
          <QrCode size={20} /> Scan QR
        </Button>
        <Button type="button" variant="outline" className="flex-1" onClick={() => setShowQr(true)}>
          <CheckSquare size={20} /> Show QR
        </Button>
      </div>

      <QrUploadFallback userId={userId} barangayId={barangayId} userBarangayId={barangayId} />

      <QrScannerDialog open={showScanner} onClose={() => setShowScanner(false)} userId={userId} barangayId={barangayId} userBarangayId={barangayId} />
      <QrShowDialog open={showQr} onClose={() => setShowQr(false)} centers={centers} barangayId={barangayId} />
    </div>
  );
}
