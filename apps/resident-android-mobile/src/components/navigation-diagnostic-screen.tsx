import { Profiler, useEffect, type ProfilerOnRenderCallback, type ReactNode } from 'react';
import { diagnosticRoute, mountDiagnosticOwner, recordNavigationDiagnostic } from '@/lib/navigation-diagnostics';

const onRender: ProfilerOnRenderCallback = (id, phase, actualDuration) => {
  recordNavigationDiagnostic('commit', diagnosticRoute(id), { durationMs: actualDuration, phase });
};

/** React commits explain JS work; they are not proof of an Android presented frame. */
export function NavigationDiagnosticScreen({ name, children }: { name: string; children: ReactNode }) {
  useEffect(() => mountDiagnosticOwner(diagnosticRoute(name)), [name]);
  return <Profiler id={name} onRender={onRender}>{children}</Profiler>;
}
