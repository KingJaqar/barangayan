import { Star } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { driveTypeConfig, type DriveRegistrationRow } from '@/hooks/use-medical-drives';

const STATUS_COLOR: Record<string, string> = {
  pending: '#F59E0B',
  confirmed: 'var(--accent)',
  attended: '#6366F1',
  cancelled: '#EF4444',
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Detail view for a single registration — web counterpart of mobile's RegistrationDetailSheet. */
export function RegistrationDetailDialog({ registration, open, onClose }: { registration: DriveRegistrationRow | null; open: boolean; onClose: () => void }) {
  if (!registration) return null;
  const drive = registration.drive;
  const cfg = drive ? driveTypeConfig(drive.type) : null;
  const statusColor = STATUS_COLOR[registration.status] ?? 'var(--accent)';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md text-left">
        <DialogHeader className="items-start text-left">
          <div className="flex w-full items-start justify-between gap-3">
            <DialogTitle>{drive?.title ?? 'Medical Drive'}</DialogTitle>
            {cfg ? (
              <span className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold" style={{ backgroundColor: `${cfg.color}22`, color: cfg.color }}>
                {cfg.label}
              </span>
            ) : null}
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-sm">
          <div className="rounded-xl bg-muted px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Applicant Number</p>
                <p className="text-lg font-bold text-primary">{registration.applicant_number}</p>
              </div>
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                <Star size={12} /> {registration.priority_score} pts
              </span>
            </div>
          </div>

          <span className="w-fit rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: `${statusColor}22`, color: statusColor }}>
            {registration.status.charAt(0).toUpperCase() + registration.status.slice(1)}
          </span>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-muted-foreground">
            <dt>Registered on</dt>
            <dd className="text-right font-medium text-foreground">{fmtDate(registration.created_at)}</dd>
            <dt>Age</dt>
            <dd className="text-right font-medium text-foreground">{registration.age}</dd>
            <dt>PWD</dt>
            <dd className="text-right font-medium text-foreground">{registration.is_pwd ? 'Yes' : 'No'}</dd>
            {registration.comorbidities.length > 0 ? (
              <>
                <dt>Comorbidities</dt>
                <dd className="text-right font-medium text-foreground">{registration.comorbidities.join(', ')}</dd>
              </>
            ) : null}
            {drive ? (
              <>
                <dt>Location</dt>
                <dd className="text-right font-medium text-foreground">{drive.location}</dd>
              </>
            ) : null}
          </dl>
        </div>
      </DialogContent>
    </Dialog>
  );
}
