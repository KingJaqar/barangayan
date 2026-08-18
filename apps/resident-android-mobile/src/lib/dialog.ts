/**
 * Cross-platform confirm / notify dialogs.
 *
 * `Alert` from react-native-web is an empty stub — `Alert.alert(...)` compiles and runs
 * but does nothing at all, so on the web build any flow gated behind a confirmation
 * dialog is silently dead: the button appears to do nothing and the handler never runs.
 * On native we keep the exact same `Alert.alert` presentation as before.
 */
import { Alert, Platform } from 'react-native';

/**
 * Asks the user to confirm an action.
 *
 * @returns `true` when confirmed, `false` when cancelled or dismissed.
 */
export function confirmAction({
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  destructive = false,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}

/** Shows a message and resolves once the user dismisses it. */
export function notify({
  title,
  message,
  okLabel = 'OK',
}: {
  title: string;
  message: string;
  okLabel?: string;
}): Promise<void> {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [{ text: okLabel, onPress: () => resolve() }]);
  });
}
