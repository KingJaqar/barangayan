'use client';

import { describeDeviceLocation, type DeviceLocationState, type LocationAction } from '@barangayan/shared';
import { AlertCircle, LocateFixed, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/loading';
import styles from './emergency.module.css';

const ACTION_LABELS: Record<LocationAction, string> = {
  locate: 'Use my location',
  retry: 'Try again',
  cancel: 'Stop',
  confirm: 'Use this location',
  reject: 'Discard',
  'open-settings': 'Open settings',
};

/** Device-location state and its actions for the Centers screen (DRRM routing plan R1). */
export function LocationStatusCard({
  state,
  onAction,
}: {
  state: DeviceLocationState;
  onAction: (action: LocationAction) => void;
}) {
  const message = describeDeviceLocation(state, 'web');
  if (!message) return null;

  const Icon = message.tone === 'info' ? LocateFixed : message.tone === 'warning' ? AlertCircle : XCircle;

  return (
    <div role="status" aria-live="polite" className={styles.locationCard}>
      <div className="flex items-start gap-2.5">
        {message.busy ? (
          <Spinner className="mt-0.5 text-primary" />
        ) : (
          <Icon size={16} className={`mt-0.5 shrink-0 ${message.tone === 'info' ? 'text-primary' : 'text-destructive'}`} />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold">{message.title}</p>
          {message.detail ? <p className="mt-0.5 text-xs text-muted-foreground">{message.detail}</p> : null}
        </div>
      </div>
      {message.actions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {message.actions.map((action, index) => (
            <Button key={action} type="button" size="sm" variant={index === 0 ? 'default' : 'outline'} className={index === 0 ? styles.primaryButton : styles.secondaryButton} onClick={() => onAction(action)}>
              {ACTION_LABELS[action]}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
