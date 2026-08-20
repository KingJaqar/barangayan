import Link from 'next/link';
import { Plus } from 'lucide-react';

import { requireUser } from '@/lib/auth/require-user';
import { MyReportsTabs } from './my-reports-tabs';

export default async function ReportsPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      {/* Page header */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">My Reports</h1>
          <p className="text-sm text-muted-foreground">Incidents you&apos;ve reported to the barangay.</p>
        </div>
        <Link
          href="/reports/new"
          className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90">
          <Plus size={16} />
          <span className="hidden sm:inline">Report Incident</span>
          <span className="sm:hidden">Report</span>
        </Link>
      </div>

      <MyReportsTabs />
    </div>
  );
}
