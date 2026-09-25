type SpinnerSize = 'compact' | 'button' | 'regular';

const sizeClasses: Record<SpinnerSize, string> = {
  compact: 'size-3',
  button: 'size-3.5',
  regular: 'size-4',
};

type SpinnerProps = {
  size?: SpinnerSize;
  className?: string;
};

/** Decorative indeterminate indicator. Pair it with a visible label or LoadingStatus. */
export function Spinner({ size = 'regular', className = '' }: SpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={`admin-loading-spinner inline-block shrink-0 rounded-full border-2 border-current border-r-transparent ${sizeClasses[size]} ${className}`}
    />
  );
}

export type { SpinnerSize };
