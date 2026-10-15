import { Skeleton } from '@/components/ui/loading';
import styles from './search.module.css';

export function SuggestionSkeleton() {
  return <div aria-hidden className={styles.suggestionSkeleton}>{[0, 1, 2].map(index => <div key={index} className={styles.placeholderRow}>
    <Skeleton className="size-8 shrink-0 rounded-lg" />
    <div className="flex flex-1 flex-col gap-2"><Skeleton className="h-3 w-4/5 rounded-full" /><Skeleton className="h-2 w-2/5 rounded-full" /></div>
  </div>)}</div>;
}

export function ResultSkeleton() {
  return <div aria-hidden className={styles.group}>
    <div className={styles.groupHeader}><Skeleton className="h-4 w-40 rounded-full" /></div>
    {[0, 1, 2].map(index => <div key={index} className={styles.result}>
      <span className="shrink-0"><Skeleton className="size-11 rounded-xl" /></span>
      <div className="flex flex-col gap-3"><Skeleton className="h-4 w-3/5 rounded-full" /><Skeleton className="h-2 w-2/5 rounded-full" /><Skeleton className="h-3 w-full rounded-full" /><Skeleton className="h-3 w-4/5 rounded-full" /></div>
    </div>)}
  </div>;
}
