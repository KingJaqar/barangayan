'use client';

/**
 * Step 1 — the modal's default view for any selected document. Content ported verbatim
 * from the standalone /services/[documentId] page (kept for deep links/guest SEO); the
 * CTA branch is the only behavioral change — it advances the in-modal step instead of
 * navigating to /services/requests/new/[documentId].
 */

import { formatCentavosAsPHP, formatProcessingTime } from '@barangayan/shared';
import { CheckCircle2, Clock, FileText } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import type { DocumentType } from './types';

export function DetailsStep({ doc, isAuthenticated, onRequest }: { doc: DocumentType; isAuthenticated: boolean; onRequest: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">{doc.name}</h2>
          {doc.description ? <p className="mt-1 text-sm text-muted-foreground">{doc.description}</p> : null}
        </div>
        <span className="shrink-0 rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">
          {doc.fee_centavos === 0 ? 'Free' : formatCentavosAsPHP(doc.fee_centavos)}
        </span>
      </div>

      {doc.requirements.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <CheckCircle2 size={16} /> Requirements
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            {doc.requirements.map((req) => (
              <li key={req} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                {req}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Clock size={16} /> Processing & Pickup
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Estimated Time</span>
          <span className="font-semibold">{formatProcessingTime(doc.processing_target_hours)}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
        <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
          <FileText size={16} /> Additional Notes
        </div>
        Please ensure all requirements are complete before proceeding. Bring the original documents for verification at the Barangay Hall.
        Processing times are estimates and may vary during peak periods.
      </div>

      {isAuthenticated ? (
        <Button size="lg" className="w-full sm:w-auto sm:self-start" onClick={onRequest}>
          Request This Document
        </Button>
      ) : (
        <Button asChild size="lg" className="w-full sm:w-auto sm:self-start">
          <Link href="/login">Log In to Request</Link>
        </Button>
      )}
    </div>
  );
}
