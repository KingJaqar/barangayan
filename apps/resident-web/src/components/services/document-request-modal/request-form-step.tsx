'use client';
import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ResidentServiceForm } from '../resident-service-form';
import type { DocumentType } from './types';
export function RequestFormStep({
  doc,
  onBack,
  onSubmitted,
}: {
  doc: DocumentType;
  residentName: string | null;
  residentMobile: string | null;
  onBack: () => void;
  onSubmitted: (id: string, reference: string) => void;
}) {
  const [client] = useState(createSupabaseBrowserClient);
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="min-h-12 underline">
        Back to Details
      </button>
      <ResidentServiceForm key={doc.id} doc={doc} client={client} onSubmitted={onSubmitted} />
    </div>
  );
}
