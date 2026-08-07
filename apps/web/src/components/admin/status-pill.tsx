// Mirrors the mobile app's status-badge.tsx color scheme (Colors.light.primary green /
// #2563EB blue / accentRed) so a resident and an admin looking at the same request agree
// on what each color means.
const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  submitted: { label: 'Submitted', className: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200' },
  in_progress: { label: 'Processing', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  out_for_delivery: { label: 'Out for Delivery', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  completed: { label: 'Completed/Delivered', className: 'bg-[#0F6E5B]/15 text-[#0F6E5B]' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  paid: { label: 'Paid', className: 'bg-[#0F6E5B]/15 text-[#0F6E5B]' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  expired: { label: 'Expired', className: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200' },
  waived: { label: 'Waived', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
};

export function StatusPill({ status }: { status: string }) {
  const config = STATUS_STYLES[status] ?? {
    label: status,
    className: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${config.className}`}>
      {config.label}
    </span>
  );
}
