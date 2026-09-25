'use client';

import type { ReactNode } from 'react';
import { useLinkStatus } from 'next/link';

import { Spinner } from '@/components/loading/spinner';

interface LinkPendingIndicatorProps {
  collapsed: boolean;
  icon: ReactNode;
  label: string;
}

/** Shows delayed, decorative navigation feedback without owning route state. */
export function LinkPendingIndicator({ collapsed, icon, label }: LinkPendingIndicatorProps) {
  const { pending } = useLinkStatus();

  return (
    <>
      <span
        aria-hidden="true"
        data-pending={collapsed && pending ? 'true' : 'false'}
        className={
          collapsed
            ? 'admin-link-pending-icon-slot relative grid size-5 shrink-0 place-items-center'
            : 'grid size-5 shrink-0 place-items-center'
        }>
        <span className="admin-link-pending-icon">{icon}</span>
        {collapsed && pending ? <Spinner size="compact" className="absolute inset-0 z-10 m-auto" /> : null}
      </span>
      {!collapsed ? <span className="min-w-0 flex-1 truncate">{label}</span> : null}
      {!collapsed ? (
        <span aria-hidden="true" className="ml-auto grid size-3 shrink-0 place-items-center">
          {pending ? <Spinner size="compact" /> : null}
        </span>
      ) : null}
    </>
  );
}
