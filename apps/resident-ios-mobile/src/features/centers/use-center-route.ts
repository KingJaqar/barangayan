import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { releaseGates } from '../../lib/release-gates';
import { useResident } from '../../lib/runtime';
import { liveRouteDependencies, RouteController, type RouteInput } from './route-controller';

/**
 * The walking route for the Centers screen; `input` must be memoized by the caller. `visible` is true while the screen is focused; the controller also stops
 * while the app is in the background and when the screen goes away, so nothing is asked, and no answer is accepted,
 * for a screen the resident cannot see.
 */
export function useCenterRoute(input: RouteInput | null, visible: boolean) {
  const { config } = useResident();
  const [controller] = useState(() => new RouteController(liveRouteDependencies(`${config.url}/functions/v1/evacuation-route`, config.anonKey, releaseGates.routeService)));
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => setForeground(next === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    controller.setActive(visible && foreground);
    return () => controller.setActive(false);
  }, [controller, visible, foreground]);
  useEffect(() => { controller.setInput(input); }, [controller, input]);
  const retry = useCallback(() => controller.retry(), [controller]);
  return { state, retry };
}
