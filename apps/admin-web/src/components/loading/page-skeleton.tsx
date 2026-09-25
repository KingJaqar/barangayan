import { LoadingStatus } from './loading-status';
import { Skeleton } from './skeleton';

type PageSkeletonProps = {
  variant: 'table' | 'dashboard' | 'map' | 'qr' | 'detail' | 'settings';
  label: string;
  className?: string;
};

function HeadingSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="h-3.5 w-64 max-w-full" />
    </div>
  );
}

function TablePageSkeleton() {
  return (
    <>
      <HeadingSkeleton />
      <div aria-hidden="true" className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-48 max-w-full rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="ml-auto h-9 w-32 rounded-lg" />
      </div>
      <div className="overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900">
        <div aria-hidden="true" className="flex items-center gap-4 border-b border-black/10 bg-zinc-100 px-4 py-3 dark:border-white/10 dark:bg-zinc-800">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="ml-auto h-3 w-20" />
        </div>
        <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} aria-hidden="true" className="flex items-center gap-4 px-4 py-4">
              <Skeleton className="h-3 w-24 max-w-[20%]" />
              <Skeleton className="h-3 w-40 max-w-[38%]" />
              <Skeleton className="ml-auto h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function DashboardPageSkeleton() {
  return (
    <>
      <HeadingSkeleton />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} aria-hidden="true" className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white p-4 dark:border-white/[0.06] dark:bg-zinc-900">
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-5 w-14" />
            </div>
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <div className="overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex items-center gap-4 border-b border-black/[0.04] px-4 py-4 last:border-0 dark:border-white/[0.04]">
              <Skeleton className="h-3 w-32 max-w-[40%]" />
              <Skeleton className="h-3 w-48 max-w-[45%]" />
              <Skeleton className="ml-auto h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} aria-hidden="true" className="space-y-3">
            <Skeleton className="h-4 w-36" />
            <div className="overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900">
              {Array.from({ length: 3 }, (_, rowIndex) => (
                <div key={rowIndex} className="flex items-center gap-4 border-b border-black/[0.04] px-4 py-4 last:border-0 dark:border-white/[0.04]">
                  <Skeleton className="h-3 w-28 max-w-[32%]" />
                  <Skeleton className="h-3 w-40 max-w-[40%]" />
                  <Skeleton className="ml-auto h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <div className="h-48 rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
          <Skeleton className="h-full w-full rounded-lg" />
        </div>
      </div>
    </>
  );
}

function MapPageSkeleton() {
  return (
    <>
      <div className="mb-8 flex items-start gap-3.5">
        <Skeleton className="size-11 shrink-0 rounded-xl" />
        <div className="space-y-2 pt-0.5">
          <Skeleton className="h-7 w-44 max-w-full" />
          <Skeleton className="h-3.5 w-56 max-w-full" />
        </div>
      </div>
      <Skeleton className="-mt-5 mb-6 ml-[58px] h-3.5 w-80 max-w-[calc(100%_-_58px)]" />
      <div aria-hidden="true" className="relative h-[calc(100vh-160px)] min-h-[500px] w-full overflow-hidden rounded-2xl border border-black/10 bg-zinc-100 dark:border-white/10 dark:bg-zinc-900">
        <div className="absolute inset-0 bg-zinc-200/40 dark:bg-zinc-800/40" />
        <Skeleton className="absolute left-4 top-4 h-10 w-64 max-w-[45%] rounded-xl" />
        <Skeleton className="absolute right-4 top-4 h-10 w-32 max-w-[35%] rounded-full" />
        <div className="absolute bottom-4 left-4 flex max-w-[calc(100%_-_2rem)] flex-wrap gap-2">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      </div>
    </>
  );
}

function QrPageSkeleton() {
  return (
    <>
      <HeadingSkeleton />
      <div aria-hidden="true" className="flex items-center gap-3">
        <Skeleton className="h-9 w-56 max-w-[60%] rounded-full" />
        <Skeleton className="h-3 w-12 rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div aria-hidden="true" className="flex flex-col gap-4">
          {[0, 1].map((item) => (
            <div key={item} className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-3">
                  <Skeleton className="h-4 w-36 max-w-full" />
                  <Skeleton className="h-3 w-52 max-w-full" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
                <Skeleton className="h-8 w-20 shrink-0 rounded-full" />
              </div>
            </div>
          ))}
        </div>
        <div aria-hidden="true" className="rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
          <Skeleton className="mx-auto h-4 w-36" />
          <div className="mx-auto mt-5 flex h-80 max-h-[55vh] w-52 max-w-full flex-col items-center justify-center gap-4 rounded-3xl border border-black/10 bg-zinc-50 p-5 dark:border-white/10 dark:bg-zinc-800">
            <Skeleton className="size-32 max-w-full rounded-xl" />
            <Skeleton className="h-3 w-32 max-w-full" />
            <Skeleton className="h-2.5 w-24 max-w-full" />
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
        </div>
      </div>
    </>
  );
}

function DetailPageSkeleton() {
  return (
    <>
      <Skeleton className="h-4 w-32" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56 max-w-full" />
          <Skeleton className="h-3.5 w-28" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>
      <div aria-hidden="true" className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-9 w-28 rounded-full" />)}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[0, 1].map((item) => (
          <div key={item} aria-hidden="true" className="space-y-3 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3.5 w-40 max-w-full" />
            <Skeleton className="h-3 w-52 max-w-full" />
            <Skeleton className="h-3 w-36 max-w-full" />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="space-y-3 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-64 max-w-full" />
        <Skeleton className="h-3 w-52 max-w-full" />
      </div>
      <div aria-hidden="true" className="space-y-4 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
        <Skeleton className="h-4 w-32" />
        {[0, 1, 2].map((item) => (
          <div key={item} className="flex gap-3">
            <Skeleton className="mt-1 size-2 shrink-0 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-40 max-w-full" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function SettingsPageSkeleton() {
  return (
    <>
      <HeadingSkeleton />
      <div aria-hidden="true" className="space-y-6 rounded-xl border border-black/10 bg-white p-4 sm:p-6 dark:border-white/10 dark:bg-zinc-900">
        <div className="space-y-4 rounded-xl border border-black/10 p-5 dark:border-white/10">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        </div>
        <div className="space-y-4 rounded-xl border border-black/10 p-5 dark:border-white/10">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="h-3 w-20 shrink-0" />
              <Skeleton className="h-9 min-w-0 flex-1 rounded-lg" />
              <Skeleton className="h-3 w-5 shrink-0" />
              <Skeleton className="h-9 min-w-0 flex-1 rounded-lg" />
            </div>
          ))}
        </div>
        <div className="space-y-4 rounded-xl border border-black/10 p-5 dark:border-white/10">
          <Skeleton className="h-4 w-28" />
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="size-4 shrink-0 rounded-sm" />
              <Skeleton className="h-3 w-52 max-w-[55%]" />
              <Skeleton className="ml-auto h-3 w-32 max-w-[30%]" />
            </div>
          ))}
        </div>
        <div className="space-y-4 rounded-xl border border-black/10 p-5 dark:border-white/10">
          <Skeleton className="h-4 w-52 max-w-full" />
          <Skeleton className="h-3 w-3/4 max-w-full" />
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="size-4 shrink-0 rounded-sm" />
              <Skeleton className="h-3 w-48 max-w-[60%]" />
              <Skeleton className="ml-auto h-5 w-9 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/** Route-content placeholder that leaves shell padding and layout to AdminShell. */
export function PageSkeleton({ variant, label, className = '' }: PageSkeletonProps) {
  const content = {
    table: <TablePageSkeleton />,
    dashboard: <DashboardPageSkeleton />,
    map: <MapPageSkeleton />,
    qr: <QrPageSkeleton />,
    detail: <DetailPageSkeleton />,
    settings: <SettingsPageSkeleton />,
  }[variant];

  return (
    <div className={`space-y-6 ${className}`}>
      <LoadingStatus message={label} />
      <div aria-busy="true" className="space-y-6">
        {content}
      </div>
    </div>
  );
}
