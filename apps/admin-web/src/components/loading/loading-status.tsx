type LoadingStatusProps = {
  message: string;
  className?: string;
};

/** A single polite announcement for a loading region. */
export function LoadingStatus({ message, className = '' }: LoadingStatusProps) {
  return (
    <p className={`sr-only ${className}`} role="status" aria-live="polite" aria-atomic="true">
      {message}
    </p>
  );
}
