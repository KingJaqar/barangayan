import { formatCentavosAsPHP, formatProcessingTime } from '@barangayan/shared';
import { CheckCircle2, Clock, FileText } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { getOptionalUser } from '@/lib/auth/get-optional-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Document detail — guest-accessible, same RLS basis as the catalog page. Ported from
 * mobile's services/[documentId].tsx (Requirements & Guidelines screen); the
 * "Request This Document" / "Log In to Request" branch below mirrors that screen's
 * session check exactly.
 */
export default async function DocumentDetailPage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const supabase = await createSupabaseServerClient();
  const { user } = await getOptionalUser();

  const { data: doc } = await supabase.from('document_types').select('*').eq('id', documentId).single();

  if (!doc) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{doc.name}</h1>
          {doc.description ? <p className="mt-1 text-sm text-muted-foreground">{doc.description}</p> : null}
        </div>
        <span className="shrink-0 rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">
          {doc.fee_centavos === 0 ? 'Free' : formatCentavosAsPHP(doc.fee_centavos)}
        </span>
      </div>

      {doc.requirements.length > 0 ? (
        <div className="mb-4 rounded-2xl border border-border bg-card p-5">
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

      <div className="mb-6 rounded-2xl border border-border bg-card p-5">
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

      <div className="mt-6">
        {user ? (
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href={`/services/requests/new/${doc.id}`}>Request This Document</Link>
          </Button>
        ) : (
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/login">Log In to Request</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
