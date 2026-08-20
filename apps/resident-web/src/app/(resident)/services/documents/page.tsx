import { formatCentavosAsPHP, formatProcessingTime } from '@barangayan/shared';
import { FileText } from 'lucide-react';
import Link from 'next/link';

import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Document catalog — guest-accessible (0005 migration's anon read policy on
 * document_types, confirmed against the migration directly rather than assumed per the
 * plan's No-Guessing Rule: `create policy "anyone can read active document types" ...
 * to anon using (is_active = true)`). Mirrors mobile's DocumentsList segment; no
 * dedicated hook the way Phase 5/health has one — a single Server Component query is
 * simpler and this list has no realtime/interactive requirement.
 */
export default async function DocumentsPage() {
  const supabase = await createSupabaseServerClient();

  const { data: documentTypes } = await supabase
    .from('document_types')
    .select('id, name, description, fee_centavos, processing_target_hours')
    .eq('is_active', true)
    .order('name');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Document Catalog</h1>
        <p className="text-sm text-muted-foreground">Browse the documents your barangay can issue, and what each one requires.</p>
      </div>

      {documentTypes && documentTypes.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {documentTypes.map((doc) => (
            <Link
              key={doc.id}
              href={`/services/${doc.id}`}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <FileText size={18} strokeWidth={1.75} />
                </div>
                <p className="font-semibold">{doc.name}</p>
              </div>
              {doc.description ? <p className="line-clamp-2 text-sm text-muted-foreground">{doc.description}</p> : null}
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{doc.fee_centavos === 0 ? 'Free' : formatCentavosAsPHP(doc.fee_centavos)}</span>
                <span>·</span>
                <span>{formatProcessingTime(doc.processing_target_hours)}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">No document types are available right now.</p>
        </div>
      )}
    </div>
  );
}
