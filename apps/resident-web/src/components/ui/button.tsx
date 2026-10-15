import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { Spinner } from './loading';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:opacity-90',
        secondary: 'bg-accent text-accent-foreground hover:bg-accent/80',
        outline: 'border border-border bg-transparent hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-6 py-2.5',
        sm: 'h-9 px-4 text-sm',
        lg: 'h-12 px-8 text-base',
        icon: 'h-9 w-9 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  /** Text shown while `loading` (e.g. "Saving…"). The button reserves the wider of the
   * two labels so it never resizes, and exposes only the visible one to assistive
   * technology. Ignored for icon-size buttons, which keep their accessible name. */
  loadingLabel?: string;
}

const labelCell = 'col-start-1 row-start-1 inline-flex items-center justify-center gap-2';

/**
 * `asChild` renders through Radix's Slot, which requires exactly one element child to
 * merge props onto (it throws "Slot failed to slot onto its children" otherwise) — so
 * the loading branches below are deliberately real `<button>`-only. asChild is only
 * used for plain navigation links, which have no pending state of their own.
 *
 * Loading feedback: disabled and aria-busy apply immediately. With `loadingLabel` the
 * label swaps immediately and its spinner appears after 120 ms. Without it, the content
 * keeps its place (and the accessible name) and cross-fades to a centered spinner after
 * 120 ms, so fast operations never flash and the button's size never changes.
 */
function Button({ className, variant, size, asChild = false, loading = false, loadingLabel, disabled, children, ...props }: ButtonProps) {
  if (asChild) {
    return (
      <Slot data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props}>
        {children}
      </Slot>
    );
  }

  const swapLabel = loadingLabel && size !== 'icon';

  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }), loading && !swapLabel && 'relative')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}>
      {swapLabel ? (
        <span className="inline-grid">
          <span className={cn(labelCell, loading && 'invisible')}>{children}</span>
          <span aria-hidden={!loading} className={cn(labelCell, !loading && 'invisible')}>
            {/* Mounted only while loading so its 120 ms delay starts with the operation;
                the idle placeholder keeps the reserved width identical. */}
            {loading ? <Spinner /> : <span className="size-4 shrink-0" />}
            {loadingLabel}
          </span>
        </span>
      ) : loading ? (
        <>
          <span className="rw-hint-out inline-flex items-center justify-center gap-2">{children}</span>
          <span className="absolute inset-0 flex items-center justify-center">
            <Spinner />
          </span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

export { Button, buttonVariants };
