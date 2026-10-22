'use client';

import { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { attendanceRequest, householdQrPayloadSchema } from '@barangayan/shared';
import { LoadingStatus } from '@/components/shared/loading-status';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/loading';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { residentHouseholdProfile } from '@/lib/household';
import { beginAttempt, notify } from '@/lib/notify';
import styles from './emergency.module.css';

/** The QR is data only. Showing it never registers attendance. */
export function HouseholdQrDialog({ onClose, profileId, residentName }: {
  onClose: () => void; profileId: string; residentName: string;
}) {
  const [payload, setPayload] = useState<string | null>(null);
  const [failure, setFailure] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const life = new AbortController();
    const notification = beginAttempt('household-qr');
    void Promise.resolve().then(async () => {
      if (life.signal.aborted) return;
      setPayload(null); setFailure(false);
      try {
        await attendanceRequest(life.signal, signal => residentHouseholdProfile(profileId, signal));
        const value = householdQrPayloadSchema.parse({ type: 'household', version: '1.0', profileId });
        if (!life.signal.aborted) setPayload(JSON.stringify(value));
      } catch (cause) {
        if (!life.signal.aborted) {
          setFailure(true);
          notify.error(cause instanceof Error && cause.message === 'resident_identity_required'
            ? 'Log in again to view your household QR code.' : "Couldn't load your household QR code. Please try again.", { id: notification });
        }
      }
    });
    return () => life.abort();
  }, [profileId, attempt]);
  const loading = !payload && !failure;
  return (
    <Dialog open onOpenChange={next => { if (!next) onClose(); }}>
      <DialogContent className={`${styles.dialog} ${styles.qrDialog}`}>
        <DialogHeader>
          <DialogTitle>Household QR Code</DialogTitle>
          <DialogDescription>Show staff this Family QR, then confirm who is present. Only staff can record attendance.</DialogDescription>
        </DialogHeader>
        <div aria-busy={loading || undefined} className={styles.qrFrame}>
          {loading ? <Spinner className="size-8 text-primary" /> : payload ? (
            <QRCodeCanvas value={payload} size={440} level="M" marginSize={4}
              bgColor="#FFFFFF" fgColor="#000000" role="img" aria-label="Household QR code" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <p role="alert" className="text-sm text-muted-foreground">Could not verify your resident account. Check your connection or sign in again.</p>
              <Button type="button" size="sm" variant="outline" onClick={() => setAttempt(value => value + 1)}>Try again</Button>
            </div>
          )}
        </div>
        <LoadingStatus active={loading} label="Preparing your QR code…" />
        <p className="text-center text-sm font-medium text-muted-foreground">{residentName}</p>
      </DialogContent>
    </Dialog>
  );
}
