import { EmergencySegmentNav } from '@/components/emergency/emergency-segment-nav';

/**
 * Shell for the 5 Emergency & DRRM routes (Hub/Centers/Scan/Family/Alerts) — just the
 * pill nav + a shared max-width wrapper. Deliberately does NOT call requireUser() itself:
 * per the plan's Phase 0 design choice ("every gated page calls requireUser() itself
 * rather than splitting into parallel layouts"), each of the 5 page.tsx files below gates
 * itself. All 5 routes are resident-only per the plan's §4 Route Contract Matrix
 * ("(resident)/emergency/* | R | Server | -> /login?next=<path>").
 */
export default function EmergencyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl">
      <EmergencySegmentNav />
      {children}
    </div>
  );
}
