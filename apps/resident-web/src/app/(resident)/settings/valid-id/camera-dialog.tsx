'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { abortable } from './transport';
import { beginAttempt, notify } from '@/lib/notify';

export function CameraDialog({ onClose, onPhoto, triggerRef }: {
  onClose: () => void; onPhoto: (file: File) => void; triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const alive = useRef(false);
  const captureAction = useRef<{ controller: AbortController; timer: ReturnType<typeof setTimeout>; canvas: HTMLCanvasElement } | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [capturing, setCapturing] = useState(false);
  useEffect(() => {
    alive.current = true;
    const captureOwner = captureAction;
    let stream: MediaStream | null = null;
    let cancelled = false;
    const attempt = beginAttempt('id-camera');
    const unavailable = () => {
      setError('Camera unavailable. Upload an existing photo.');
      notify.error("Couldn't open the camera. Allow camera access or upload a photo.", { id: attempt });
    };
    const timer = setTimeout(() => {
      cancelled = true;
      stream?.getTracks().forEach(track => track.stop());
      if (alive.current) { setReady(false); unavailable(); }
    }, 30000);
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      clearTimeout(timer);
      void Promise.resolve().then(() => { if (!cancelled) unavailable(); });
    } else {
      navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } }).then(async result => {
        if (cancelled) { result.getTracks().forEach(track => track.stop()); return; }
        stream = result;
        if (video.current) { video.current.srcObject = result; await video.current.play(); }
        clearTimeout(timer);
        if (!cancelled) setReady(true);
      }).catch(() => {
        clearTimeout(timer);
        stream?.getTracks().forEach(track => track.stop());
        if (!cancelled) unavailable();
      });
    }
    return () => {
      alive.current = false; cancelled = true; clearTimeout(timer); stream?.getTracks().forEach(track => track.stop());
      const action = captureOwner.current;
      if (action) { action.controller.abort(); clearTimeout(action.timer); action.canvas.width = action.canvas.height = 0; captureOwner.current = null; }
    };
  }, []);
  async function capture() {
    if (!ready || captureAction.current || !video.current) return;
    setCapturing(true);
    const attempt = beginAttempt('id-capture');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const canvas = document.createElement('canvas');
    captureAction.current = { controller, timer, canvas };
    try {
      const source = video.current;
      if (!source.videoWidth || !source.videoHeight) throw new Error('empty');
      const scale = Math.min(1, 2400 / Math.max(source.videoWidth, source.videoHeight));
      canvas.width = Math.max(1, Math.round(source.videoWidth * scale)); canvas.height = Math.max(1, Math.round(source.videoHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas');
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      const blob = await abortable(new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92)), controller.signal);
      canvas.width = canvas.height = 0;
      if (!blob?.size || blob.size > 5242880) throw new Error('encode');
      if (alive.current) onPhoto(new File([blob], 'id-front.jpg', { type: 'image/jpeg' }));
    } catch {
      if (alive.current) {
        setError('Could not capture this photo. Try again or upload an existing photo.');
        notify.error("Couldn't capture the photo. Try again or upload an existing photo.", { id: attempt });
      }
    } finally { clearTimeout(timer); canvas.width = canvas.height = 0; captureAction.current = null; if (alive.current) setCapturing(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg" onCloseAutoFocus={event => { event.preventDefault(); triggerRef.current?.focus(); }}>
      <DialogTitle>Take a front ID photo</DialogTitle>
      <DialogDescription>Keep the full front of your ID in view, with readable text and no glare.</DialogDescription>
      <video ref={video} autoPlay muted playsInline className="aspect-video w-full rounded-xl bg-black object-contain" />
      {error ? <p className="text-sm text-destructive">{error}</p> : !ready ? <p role="status">Waiting for camera permission… You can cancel at any time.</p> : null}
      <Button disabled={!ready} loading={capturing} loadingLabel="Capturing…" onClick={() => void capture()}>Capture photo</Button>
      <Button variant="outline" onClick={onClose}>Cancel and use Upload</Button>
    </DialogContent>
  </Dialog>;
}
