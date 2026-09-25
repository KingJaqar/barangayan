import type { ReactNode } from 'react';

import { Spinner, type SpinnerSize } from './spinner';

type TextButtonContentProps = {
  mode?: 'text';
  pending: boolean;
  pendingLabel: string;
  children: ReactNode;
  className?: string;
  spinnerSize?: SpinnerSize;
};

type IconButtonContentProps = {
  mode: 'icon';
  pending: boolean;
  children: ReactNode;
  className?: string;
  spinnerSize?: SpinnerSize;
};

type LoadingButtonContentProps = TextButtonContentProps | IconButtonContentProps;

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

  return (
    <span className={`inline-grid max-w-full align-middle whitespace-nowrap ${className}`}>
      <span
        aria-hidden={pending}
        className={`col-start-1 row-start-1 inline-flex items-center gap-2 ${pending ? 'opacity-0' : ''}`}>
        {children}
      </span>
      <span
        aria-hidden={!pending}
        className={`col-start-1 row-start-1 inline-flex items-center gap-2 ${pending ? '' : 'opacity-0'}`}>
        <Spinner size={spinnerSize} />
        {props.pendingLabel}
      </span>
    </span>
  );
}
