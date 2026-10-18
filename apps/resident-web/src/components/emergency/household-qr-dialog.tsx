'use client';

import { QrCode } from 'lucide-react';
import { useEffect, useState } from 'react';

import { LoadingStatus } from '@/components/shared/loading-status';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/loading';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { beginAttempt, notify } from '@/lib/notify';
import styles from './emergency.module.css';

/**
 * Web port of household-qr-modal.tsx / family-content.tsx's "My QR Code" card — calls
 * the `generate-household-qr` edge function [C-038], which requires the caller's own
 * session JWT and returns a PNG encoding `{ type: 'household', profileId }` (see the
 * function's own source comment: it deliberately does NOT accept an unauthenticated
 * profileId param or echo the resident's name/barangay, per its BUG-03 fix).
 */
export function HouseholdQrDialog({ open, onClose, profileId, residentName }: { open: boolean; onClose: () => void; profileId: string; residentName: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<'session' | 'unavailable' | null>(null);
  // Bumped by "Try again": a read-only re-request of the same code (nothing is created).
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    const notification = beginAttempt('household-qr');

    async function load() {
      setLoading(true);
      setFailure(null);
      setImageUrl(null);
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!session?.access_token) {
          setFailure('session');
          notify.error('Log in again to view your household QR code.', { id: notification });
          return;
        }

        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-household-qr?profileId=${profileId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (cancelled) return;
        if (res.status === 401) {
          setFailure('session');
          notify.error('Log in again to view your household QR code.', { id: notification });
          return;
        }
        if (!res.ok) throw new Error('Failed to generate QR code');
        const blob = await res.blob();
        // Created only while this request is still the current one, so a late response
        // never leaves an unrevoked object URL behind.
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      } catch {
        if (!cancelled) {
          setFailure('unavailable');
          notify.error("Couldn't load your household QR code. Please try again.", { id: notification });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, profileId, attempt]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={`${styles.dialog} ${styles.qrDialog}`}>
        <DialogHeader>
          <DialogTitle>Household QR Code</DialogTitle>
          <DialogDescription>Present this code at evacuation centers for quick family check-in.</DialogDescription>
        </DialogHeader>

        {/* Fixed geometry: the QR frame never resizes between loading, ready and failed. */}
        <div aria-busy={loading || undefined} className={styles.qrFrame}>
          {loading ? (
            <Spinner className="size-8 text-primary" />
          ) : imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- server-issued PNG blob URL, not a next/image-eligible remote asset
            <img src={imageUrl} alt="Household QR code" className="h-full w-full object-contain" />
          ) : failure ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-xs text-muted-foreground">
                {failure === 'session' ? 'Your session has ended. Log in again to show your household code.' : "We couldn't generate your QR code."}
              </p>
              {failure === 'unavailable' ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
                  Try again
                </Button>
              ) : null}
            </div>
          ) : (
            <QrCode size={80} className="text-muted-foreground" strokeWidth={1.5} />
          )}
        </div>

        <LoadingStatus active={loading} label="Generating your QR code…" />
        <p className="text-center text-sm font-medium text-muted-foreground">{residentName}</p>
      </DialogContent>
    </Dialog>
  );
}
