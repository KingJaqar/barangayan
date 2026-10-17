import type { LocationAction, LocationStatusMessage } from '@barangayan/shared';
import { Action, Body, Card } from '../../components/ui';

const LABEL: Record<LocationAction, string> = {
  locate: 'Use my location', retry: 'Try again', cancel: 'Cancel', confirm: 'Use this location', reject: 'Do not use it', 'open-settings': 'Open Settings',
};

export type LocationHandlers = { locate: () => void; cancel: () => void; confirm: () => void; reject: () => void; openSettings: () => void };

/**
 * The foreground-location state in plain words with the actions that state allows (permission
 * prompt, denial with Settings, slow/timed-out fix, fix that needs confirmation). Wording comes from the
 * shared controller so every platform explains the same states the same way.
 */
export function LocationCard({ message, handlers, onDismiss }: { message: LocationStatusMessage; handlers: LocationHandlers; onDismiss?: () => void }) {
  const run: Record<LocationAction, () => void> = {
    locate: handlers.locate, retry: handlers.locate, cancel: handlers.cancel, confirm: handlers.confirm, reject: handlers.reject, 'open-settings': handlers.openSettings,
  };
  const dismissible = onDismiss && !message.busy && !message.actions.includes('confirm');
  return <Card>
    <Body role="headline" tone={message.tone === 'error' ? 'danger' : 'primary'}>{message.title}</Body>
    {!!message.detail && <Body tone="secondary">{message.detail}</Body>}
    {message.actions.map((action) => <Action key={action} label={LABEL[action]} secondary={action !== 'locate' && action !== 'confirm'} onPress={run[action]} />)}
    {dismissible && <Action label="Not now" secondary onPress={onDismiss} />}
  </Card>;
}
