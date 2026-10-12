import { Skeleton } from '@/components/ui/loading';

/** Placeholder rows matching HotlineRow / accordion rows (icon circle + two text lines).
 * Decorative; announce loading with a LoadingStatus in the owning region. */
export function HotlineSkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-4/5 rounded" />
            <Skeleton className="h-3 w-2/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
