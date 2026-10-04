'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Tables } from '@barangayan/shared';
import {
  ResidentServiceForm,
  VerificationNotice,
} from '../../../../../../resident-web/src/components/services/resident-service-form';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
export function NewRequestForm({ documentTypes }: { documentTypes: Tables<'document_types'>[] }) {
  const router = useRouter();
  const [id, setId] = useState('');
  const [client] = useState(createSupabaseBrowserClient);
  const selected = documentTypes.find((doc) => doc.id === id);
  return (
    <div className="space-y-5">
      <VerificationNotice client={client} profileHref="/resident/profile#upload-valid-id" />
      <label>
        Document type
        <select
          aria-label="Document type"
          className="block w-full rounded-lg border p-3"
          value={id}
          onChange={(event) => setId(event.target.value)}
        >
          <option value="">Choose a document</option>
          {documentTypes.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.name}
            </option>
          ))}
        </select>
      </label>
      {selected ? (
        <ResidentServiceForm
          key={selected.id}
          doc={selected}
          client={client}
          profileHref="/resident/profile#upload-valid-id"
          onSubmitted={(requestId) => router.replace('/resident/requests/' + requestId)}
        />
      ) : null}
    </div>
  );
}
