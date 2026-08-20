'use client';

import { QrCode } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    async function load() {
      setLoading(true);
      setFailed(false);
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setFailed(true);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-household-qr?profileId=${profileId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) throw new Error('Failed to generate QR code');
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setImageUrl(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, profileId]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Household QR Code</DialogTitle>
          <DialogDescription>Present this code at evacuation centers for quick family check-in.</DialogDescription>
        </DialogHeader>

        <div className="mx-auto flex h-64 w-64 items-center justify-center rounded-2xl border border-border bg-white p-3">
          {loading ? (
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          ) : imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- server-issued PNG blob URL, not a next/image-eligible remote asset
            <img src={imageUrl} alt="Household QR code" className="h-full w-full object-contain" />
          ) : failed ? (
            <p className="text-center text-xs text-muted-foreground">Unable to generate QR code. Try again later.</p>
          ) : (
            <QrCode size={80} className="text-muted-foreground" strokeWidth={1.5} />
          )}
        </div>

        <p className="text-center text-sm font-medium text-muted-foreground">{residentName}</p>
      </DialogContent>
    </Dialog>
  );
}
