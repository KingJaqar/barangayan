import type { ReactNode } from 'react';

import { Spinner, type SpinnerSize } from './spinner';

type TextButtonContentProps = {
  mode?: 'text';
  pending: boolean;
  pendingLabel: string;
  children: ReactNode;
  className?: string;
  spinnerSize?: SpinnerSize;
  wrapText?: boolean;
};

type IconButtonContentProps = {
  mode: 'icon';
  pending: boolean;
  children: ReactNode;
  className?: string;
  spinnerSize?: SpinnerSize;
};

type LoadingButtonContentProps = TextButtonContentProps | IconButtonContentProps;

const spinnerSlotSizeClasses: Record<SpinnerSize, string> = {
  compact: 'size-3',
  button: 'size-3.5',
  regular: 'size-4',
};

/** Content only; set aria-busy on the existing button and keep its handler and disabled rule. */
export function LoadingButtonContent(props: LoadingButtonContentProps) {
  const { pending, children, className = '', spinnerSize = 'button' } = props;

  if (props.mode === 'icon') {
    return (
      <span aria-hidden="true" className={`inline-flex size-5 items-center justify-center ${className}`}>
        {pending ? <Spinner size={spinnerSize} /> : children}
      </span>
    );
  }

  const wrappingClasses = props.wrapText
    ? 'min-w-0 whitespace-normal break-words'
    : 'whitespace-nowrap';
  const wrappingItemClasses = props.wrapText
    ? 'min-w-0 max-w-full whitespace-normal break-words'
    : '';

  return (
    <span className={`inline-grid max-w-full align-middle ${wrappingClasses} ${className}`}>
      <span
        aria-hidden={pending}
        className={`col-start-1 row-start-1 inline-flex items-center gap-2 ${wrappingItemClasses} ${pending ? 'opacity-0' : ''}`}>
        {children}
      </span>
      <span
        aria-hidden={!pending}
        className={`col-start-1 row-start-1 inline-flex items-center gap-2 ${wrappingItemClasses} ${pending ? '' : 'opacity-0'}`}>
        <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center ${spinnerSlotSizeClasses[spinnerSize]}`}>
          {pending ? <Spinner size={spinnerSize} /> : null}
        </span>
        {props.pendingLabel}
      </span>
    </span>
  );
}
