'use client';
import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ResidentServiceForm } from '../resident-service-form';
import type { DocumentType } from './types';
import { ArrowLeft } from 'lucide-react';
import styles from './document-request-modal.module.css';
export function RequestFormStep({
  doc,
  onBack,
  onSubmitted,
}: {
  doc: DocumentType;
  onBack: () => void;
  onSubmitted: (id: string, reference: string) => void;
}) {
  const [client] = useState(createSupabaseBrowserClient);
  return (
    <div className={styles.requestForm}>
      <button type="button" onClick={onBack} className={styles.back}>
        <ArrowLeft size={16} aria-hidden /> Back to Details
      </button>
      <p className={styles.eyebrow}>Your request details</p>
      <ResidentServiceForm key={doc.id} doc={doc} client={client} onSubmitted={onSubmitted} />
    </div>
  );
}
