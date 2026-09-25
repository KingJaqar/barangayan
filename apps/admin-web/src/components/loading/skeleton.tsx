type SkeletonProps = {
  className?: string;
};

/** Shape-only placeholder. Supply its dimensions through className. */
export function Skeleton({ className = '' }: SkeletonProps) {
  return <div aria-hidden="true" className={`admin-loading-skeleton shimmer block rounded-md ${className}`} />;
}
