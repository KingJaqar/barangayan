import { Skeleton } from '@/components/ui/loading';
import { LoadingStatus } from '@/components/shared/loading-status';
import { cn } from '@/lib/utils';
import homeStyles from '@/components/home/home.module.css';

export type PageSkeletonVariant = 'home' | 'list' | 'form' | 'detail' | 'settings' | 'map';

/**
 * Route-level placeholder compositions that mirror the destination pages' own content
 * geometry (max widths, headings, card grids). They render inside the existing shell's
 * <main>, so they never repeat the shell header, padding, or navigation.
 */
const DEFAULT_LABEL: Record<PageSkeletonVariant, string> = {
  home: 'Loading home…',
  list: 'Loading list…',
  form: 'Loading form…',
  detail: 'Loading details…',
  settings: 'Loading settings…',
  map: 'Loading map…',
};

function Heading({ wide = false }: { wide?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className={cn('h-7 rounded-lg', wide ? 'w-64 max-w-full' : 'w-44')} />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}

function Body({ variant }: { variant: PageSkeletonVariant }) {
  switch (variant) {
    case 'home':
      return (
        <div className={homeStyles.home}>
          <Skeleton className={homeStyles.skeletonHero} />
          <Skeleton className="mb-4 h-6 w-44" />
          <div className={homeStyles.actions}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className={homeStyles.skeletonAction} />)}
          </div>
          <div className={`${homeStyles.dashboardLayout} mt-7`}>
            <div>
              <Skeleton className="mb-4 h-6 w-44" />
              <Skeleton className={homeStyles.skeletonPanel} />
            </div>
            <div className={homeStyles.activitySidebar}>
              <Skeleton className="mb-4 h-6 w-44" />
              <div className={homeStyles.activity}>
                <Skeleton className={homeStyles.skeletonPanel} />
                <Skeleton className={homeStyles.skeletonPanel} />
              </div>
            </div>
          </div>
        </div>
      );
    case 'list':
      return (
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <Heading />
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-20 rounded-full" />)}
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        </div>
      );
    case 'form':
      return (
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          <Heading />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-11 rounded-lg" />
            </div>
          ))}
          <Skeleton className="h-12 rounded-full" />
        </div>
      );
    case 'detail':
      return (
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <Skeleton className="h-4 w-24" />
          <Heading />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      );
    case 'settings':
      return (
        <div className="flex flex-col gap-4">
          <Heading />
          <div className="flex flex-col gap-3 rounded-2xl border border-border p-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>
      );
    case 'map':
      // The map viewport stays steady (no pulse) per the plan's motion rules.
      return (
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <Heading />
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_300px]">
            <Skeleton pulse={false} className="h-[60vh] min-h-80 rounded-2xl" />
            <div className="flex flex-col gap-2.5">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          </div>
        </div>
      );
  }
}

export function PageSkeleton({ variant, label }: { variant: PageSkeletonVariant; label?: string }) {
  return (
    // The label sits after the shapes so the top of the placeholder lines up with the
    // destination's heading when real content replaces it.
    <div className="flex flex-col gap-4">
      <div aria-hidden>
        <Body variant={variant} />
      </div>
      <LoadingStatus active label={label ?? DEFAULT_LABEL[variant]} className="mx-auto w-full max-w-6xl" />
    </div>
  );
}
