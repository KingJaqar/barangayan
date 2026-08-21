import { HealthSegmentNav } from '@/components/health/health-segment-nav';

/**
 * Shell for the 2 Health routes (Active Drives / My Registrations) — same pattern as
 * emergency/layout.tsx: a shared pill nav + max-width wrapper, no requireUser() here
 * (each page.tsx gates itself per the plan's Phase 0 design choice).
 */
export default function HealthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl">
      <HealthSegmentNav />
      {children}
    </div>
  );
}
