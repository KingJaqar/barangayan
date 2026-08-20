import { formatCentavosAsPHP, formatDateTime } from '@barangayan/shared';
import { FileText } from 'lucide-react';

import { StatusPill } from '@/components/shared/status-pill';
import { requireUser } from '@/lib/auth/require-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Ported from mobile's LogsList — per the plan's §18 flagged unknown ("exact scope of
 * services/logs"), confirmed against the mobile source directly: it's derived from
 * service_requests ordered by last activity (updated_at), not a dedicated
 * payments/activity-log table — "there's no dedicated payments/activity-log table yet",
 * per that component's own comment. Resolving this here rather than guessing a shape,
 * per the plan's No-Guessing Rule.
 */
export default async function LogsPage() {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: requests } = await supabase
    .from('service_requests')
    .select('id, status, updated_at, document_types(name, fee_centavos)')
    .eq('resident_id', user.id)
    .order('updated_at', { ascending: false });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Activity Log</h1>
        <p className="text-sm text-muted-foreground">Recent activity across all your document requests.</p>
      </div>

      {requests && requests.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {requests.map((r) => (
            <div key={r.id} className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <FileText size={16} strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.document_types?.name ?? 'Document Request'}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(r.updated_at)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  {r.document_types?.fee_centavos === 0 ? 'Free' : formatCentavosAsPHP(r.document_types?.fee_centavos ?? 0)}
                </span>
                <StatusPill status={r.status} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        </div>
      )}
    </div>
  );
}
