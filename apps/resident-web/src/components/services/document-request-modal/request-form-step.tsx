'use client';

/**
 * Step 2 — ported from requests/new/[documentId]/new-request-form.tsx. Two behavioral
 * changes from the original: (1) no useRouter — on success it hands the new row's id
 * *and* reference_number up to the modal shell (the original only needed the id, since
 * the next screen re-fetched the row itself; the modal instead threads both straight
 * into payment-method-step's props to avoid a redundant fetch), and (2) a Back control
 * that returns to details-step. Going back is safe here specifically because nothing
 * has been written to the database yet — once submitted there is no way back into this
 * step (see document-request-modal.tsx's step-transition comment).
 */

import { formatCentavosAsPHP, formatProcessingTime, requestFormSchema } from '@barangayan/shared';
import { ChevronLeft, CloudUpload, Phone, User } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { isWithinSizeLimit, isAcceptedImageType, imageExtension } from '@/lib/image-upload';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { DocumentType } from './types';

const MAX_ID_BYTES = 5 * 1024 * 1024;

export function RequestFormStep({
  doc,
  residentName,
  residentMobile,
  onBack,
  onSubmitted,
}: {
  doc: DocumentType;
  residentName: string | null;
  residentMobile: string | null;
  onBack: () => void;
  onSubmitted: (requestId: string, referenceNumber: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState('');
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [idUploadError, setIdUploadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;

    if (!isAcceptedImageType(file)) {
      setIdUploadError('Please choose a JPG, PNG, or WEBP image of your valid ID.');
      return;
    }
    if (!isWithinSizeLimit(file, MAX_ID_BYTES)) {
      setIdUploadError('Your ID image must be 5MB or smaller.');
      return;
    }

    setIdUploadError(null);
    setPickedFile(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  async function uploadIdDocument(userId: string): Promise<{ path: string | null; error: string | null }> {
    if (!pickedFile) return { path: null, error: null };

    const supabase = createSupabaseBrowserClient();
    const ext = imageExtension(pickedFile.type);
    const folderId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const path = `${userId}/${folderId}/id.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('id-documents')
      .upload(path, pickedFile, { contentType: pickedFile.type, upsert: false });
    if (uploadError) {
      return { path: null, error: uploadError.message };
    }
    return { path, error: null };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = requestFormSchema.safeParse({
      documentTypeId: doc.id,
      requesterNotes: notes || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input.');
      return;
    }

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSubmitting(false);
      setError('Your session has expired. Please log in again.');
      return;
    }

    const { path: idDocumentPath, error: uploadError } = await uploadIdDocument(user.id);
    if (uploadError) {
      setSubmitting(false);
      setError(uploadError);
      return;
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('service_requests')
      .insert({
        barangay_id: doc.barangay_id,
        resident_id: user.id,
        document_type_id: parsed.data.documentTypeId,
        requester_notes: parsed.data.requesterNotes ?? null,
        id_document_path: idDocumentPath,
      })
      .select('id, reference_number')
      .single();

    setSubmitting(false);

    if (insertErr || !inserted) {
      toast.error(`Failed to submit request: ${insertErr?.message ?? 'Unknown error'}`);
      return;
    }

    onSubmitted(inserted.id, inserted.reference_number);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ChevronLeft size={16} /> Back to Details
      </button>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-1 font-semibold">{doc.name}</p>
        {doc.description ? <p className="mb-2 text-sm text-muted-foreground">{doc.description}</p> : null}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{doc.fee_centavos === 0 ? 'Free' : formatCentavosAsPHP(doc.fee_centavos)}</span>
          <span>·</span>
          <span>{formatProcessingTime(doc.processing_target_hours)}</span>
        </div>
        {doc.requirements.length > 0 ? (
          <div className="mt-3 rounded-xl border border-status-warning/30 bg-status-warning/10 p-3 text-sm text-status-warning">
            <p className="mb-1 font-semibold">Requirements</p>
            <ul className="list-inside list-disc">
              {doc.requirements.map((req) => (
                <li key={req}>{req}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resident Details</p>
          <Link href="/settings/profile" className="text-xs font-medium text-primary hover:underline">
            Edit in Profile
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs">
            <User size={14} /> {residentName ?? '—'}
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs">
            <Phone size={14} /> {residentMobile ?? 'No mobile number on file'}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Purpose of Request (optional)</Label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="e.g. Employment requirement"
          className="w-full rounded-lg border border-input bg-transparent px-3.5 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="font-medium">Valid ID Upload</p>
        <p className="mb-3 text-sm text-muted-foreground">Please upload a clear copy of a government-issued ID.</p>

        {pickedFile && previewUrl ? (
          <div className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview, next/image's remotePatterns is for Supabase Storage only */}
            <img src={previewUrl} alt="Selected ID preview" className="max-h-56 w-full rounded-xl border border-border object-contain" />
            <p className="truncate text-xs text-muted-foreground">{pickedFile.name}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              Upload Again
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border py-8 text-center transition-colors hover:border-primary/40">
            <CloudUpload size={28} className="text-muted-foreground" />
            <span className="text-sm font-semibold">Click to upload your ID image</span>
            <span className="text-xs text-muted-foreground">JPG, PNG, or WEBP up to 5MB</span>
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePickFile} />
        {idUploadError ? <p className="mt-2 text-sm text-status-error">{idUploadError}</p> : null}
      </div>

      {error ? <p className="text-sm text-status-error">{error}</p> : null}

      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
        <span className="text-sm text-muted-foreground">Processing Fee</span>
        <span className="text-sm font-semibold">{doc.fee_centavos === 0 ? 'Free' : formatCentavosAsPHP(doc.fee_centavos)}</span>
      </div>

      <Button type="submit" size="lg" loading={submitting} className="self-start">
        Proceed to Payment →
      </Button>
    </form>
  );
}
