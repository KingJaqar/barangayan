import type { ReactNode } from 'react';

/** Preserve the page heading for assistive technology without an introductory card. */
export function EmergencyPageHeader({ title }: {
  title: ReactNode;
}) {
  return <h1 className="sr-only">{title}</h1>;
}
