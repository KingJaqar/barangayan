import { Ionicons } from '@expo/vector-icons';
import { describeConnectedFailure, type ConnectedRouteFailure } from '@barangayan/shared/src/lib/connected-route-client';
import type { AttachmentCandidate } from '@barangayan/shared/src/lib/evacuation-routing';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { LocalRouteState } from '@/hooks/use-local-route';
import type { OfflineRoutingState } from '@/hooks/use-offline-routing';
import type { RouteMode } from '@/hooks/use-resident-route';
import { useTheme } from '@/hooks/use-theme';
import type { ActivationDeferral, LocalConditionsProblem } from '@/lib/offline-routing';

/** Plan section 4: a conditions check older than 15 minutes shows a stale warning. */
const STALE_CONDITIONS_MS = 15 * 60_000;

export function formatAge(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

const PROBLEM_TEXT: Record<LocalConditionsProblem, string> = {
  no_conditions: 'Connect to the internet once to download evacuation centers and road closures for offline routes.',
  graph_not_active: 'The barangay has not activated this map version yet, so routes are not available.',
  closures_unmapped: 'A verified road closure is not matched to this map yet, so routes are paused for safety.',
  snapshot_outdated: 'Saved road conditions are out of date. Connect to refresh them.',
};

const DEFERRAL_TEXT: Record<ActivationDeferral, string> = {
  conditions_unavailable: 'it needs a connection to check road closures',
  graph_not_active: 'the barangay has not activated it yet',
  snapshot_outdated: 'road conditions must be refreshed first',
  closures_unmapped: 'a verified closure is not matched to it yet',
  avoidance_unresolved: 'one of your blocked roads does not match it; review your blocked roads',
};

function routeMessage(route: LocalRouteState): { text: string; tone: 'info' | 'warning'; busy?: boolean } | null {
  switch (route.status) {
    case 'idle':
      return null;
    case 'computing':
      return { text: 'Calculating walking route on this phone…', tone: 'info', busy: true };
    case 'unavailable':
      return { text: PROBLEM_TEXT[route.problem], tone: 'warning' };
    case 'done':
      break;
  }
  const result = route.result;
  switch (result.status) {
    case 'ok':
      return result.warnings.some(w => w.code === 'unknown_center_availability')
        ? { text: 'No center is confirmed open on a safe route, so this one has unconfirmed availability.', tone: 'warning' }
        : null;
    case 'attachment_ambiguous':
      return { text: 'Several streets are near your location. Choose the one you are on:', tone: 'info' };
    case 'outside_coverage':
      return { text: 'You are outside the Ampid I route area. Walking routes are only available inside Ampid I.', tone: 'warning' };
    case 'no_nearby_path':
      return { text: 'No walkable street is within 50 m of your location.', tone: 'warning' };
    case 'no_route_within_coverage':
      return { text: 'No open walking route reaches this center. Closures or your blocked roads cut it off.', tone: 'warning' };
    case 'center_unavailable':
      return { text: 'This center cannot be routed to: it is unavailable or its entrance is not reviewed yet.', tone: 'warning' };
    case 'restrictions_unmapped':
      return { text: 'Some blocked roads do not match the installed map. Review your blocked roads.', tone: 'warning' };
    case 'invalid_origin':
      return { text: 'Your location could not be used for routing. Try locating again.', tone: 'warning' };
    case 'invalid_conditions':
      return { text: 'Saved road conditions are inconsistent. Connect to refresh them.', tone: 'warning' };
    case 'cancelled':
      return null;
  }
}

/**
 * Offline routing status for the Centers screen (DRRM routing plan R6): the age of the installed
 * map and road conditions, and every route outcome in words. A failed route is never drawn as a
 * straight line (invariant 7).
 */
export function OfflineRouteCard({
  routing,
  route,
  mode,
  connectedFailure,
  connectedPending,
  now,
  onChooseSegment,
  compact = false,
  style,
}: {
  routing: OfflineRoutingState;
  route: LocalRouteState;
  mode: RouteMode;
  connectedFailure: ConnectedRouteFailure | null;
  connectedPending: boolean;
  now: number;
  onChooseSegment: (candidate: AttachmentCandidate) => void;
  /** Over the map: one summary line that expands on tap, so the card does not hide the route. */
  compact?: boolean;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  if (routing.phase === 'loading') {
    return (
      <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }, style]}>
        <View style={styles.row}>
          <ActivityIndicator size="small" color={theme.primary} />
          <ThemedText type="small">Loading the offline map…</ThemedText>
        </View>
      </View>
    );
  }

  const lines: { text: string; tone: 'info' | 'warning' }[] = [];
  if (routing.phase === 'failed' || routing.pack === null) {
    lines.push({ text: 'The offline map could not be loaded on this phone. Routes are unavailable.', tone: 'warning' });
  } else {
    const storedAt = routing.conditions ? Date.parse(routing.conditions.storedAt) : null;
    const lastCheck = Math.max(storedAt ?? 0, routing.conditionsCheckedAt ?? 0);
    if (storedAt === null) {
      lines.push({ text: 'Road closures and center status have not been downloaded yet.', tone: 'warning' });
    } else if (now - lastCheck > STALE_CONDITIONS_MS || routing.conditionsFailures > 0) {
      lines.push({ text: `Offline: road closures and center status from ${formatAge(now - lastCheck)}.`, tone: 'warning' });
    } else {
      lines.push({ text: `Road closures checked ${formatAge(now - lastCheck)}.`, tone: 'info' });
    }
    if (routing.pendingUpdate) lines.push({ text: `A newer map is waiting: ${DEFERRAL_TEXT[routing.pendingUpdate.reason]}.`, tone: 'info' });
    if (routing.avoidanceUnreadable) lines.push({ text: 'Your saved blocked roads could not be read and were set aside.', tone: 'warning' });
  }
  const message = routeMessage(route);
  // Mode and route-service status (plan section 4): connected routes use the service's current
  // conditions; after a failure the labelled local route stays until a request succeeds again.
  let modeLine: { text: string; tone: 'info' | 'warning' } | null = null;
  if (routing.pack !== null) {
    if (mode === 'connected') {
      modeLine = { text: 'Route calculated by the Barangayan route service with current road conditions.', tone: 'info' };
    } else if (connectedFailure !== null) {
      modeLine = { text: `${describeConnectedFailure(connectedFailure)} Showing the route calculated on this phone.`, tone: 'warning' };
    } else if (connectedPending && route.status === 'done') {
      modeLine = { text: 'Checking the route service…', tone: 'info' };
    }
    if (modeLine !== null) lines.push(modeLine);
  }
  const shorter = route.status === 'done' && route.result.status === 'ok' ? route.result : null;
  if (shorter !== null && shorter.shortest !== null) {
    const extra = Math.round(shorter.best.distanceMeters - shorter.shortest.distanceMeters);
    const reason = shorter.shortestAvoids.includes('sensor_risk')
      ? 'it avoids a road near a high river gauge reading'
      : shorter.shortestAvoids.includes('traffic')
        ? 'it avoids congestion'
        : 'it is safer';
    lines.push({ text: `The recommended route is ${extra} m longer than the shortest open route because ${reason}.`, tone: 'info' });
  }
  const candidates = route.status === 'done' && route.result.status === 'attachment_ambiguous' ? route.result.candidates : [];
  const osmDate = routing.pack?.manifest.osmBaseTimestamp?.slice(0, 10);

  // Collapsed summary: the most important line (a warning first, then a running calculation, then
  // the route outcome or mode). Choosing a street needs the full card, so it never collapses then.
  if (compact && !expanded && candidates.length === 0) {
    const warning = message?.tone === 'warning' ? message : lines.find(line => line.tone === 'warning');
    const summary = warning ?? message ?? modeLine ?? lines[0];
    const busy = summary === message && message?.busy === true;
    const hiddenCount = lines.length + (message ? 1 : 0) - 1;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLiveRegion="polite"
        accessibilityState={{ expanded: false }}
        accessibilityHint="Shows road condition and route details"
        onPress={() => setExpanded(true)}
        style={[styles.card, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }, style]}>
        <View style={styles.row}>
          {busy ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Ionicons
              name={summary.tone === 'info' ? 'cloud-done-outline' : 'alert-circle-outline'}
              size={16}
              color={summary.tone === 'info' ? theme.primary : theme.accentRed}
            />
          )}
          <ThemedText type="smallBold" numberOfLines={2} style={styles.text}>
            {summary.text}
          </ThemedText>
          {hiddenCount > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              +{hiddenCount}
            </ThemedText>
          ) : null}
          <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
        </View>
      </Pressable>
    );
  }

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.card, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }, style]}>
      {lines.map(line => (
        <View key={line.text} style={styles.row}>
          <Ionicons name={line.tone === 'info' ? 'cloud-done-outline' : 'cloud-offline-outline'} size={16} color={line.tone === 'info' ? theme.primary : theme.accentRed} />
          <ThemedText type="small" style={styles.text}>
            {line.text}
          </ThemedText>
        </View>
      ))}
      {message ? (
        <View style={styles.row}>
          {message.busy ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Ionicons name={message.tone === 'info' ? 'walk-outline' : 'alert-circle-outline'} size={16} color={message.tone === 'info' ? theme.primary : theme.accentRed} />
          )}
          <ThemedText type="smallBold" style={styles.text}>
            {message.text}
          </ThemedText>
        </View>
      ) : null}
      {candidates.length > 0 ? (
        <View style={styles.choices}>
          {candidates.map(candidate => (
            <Pressable
              key={candidate.edgeId}
              accessibilityRole="button"
              onPress={() => onChooseSegment(candidate)}
              style={[styles.choice, { borderColor: theme.primary }]}>
              <ThemedText type="smallBold" style={{ color: theme.primary }}>
                {candidate.name ?? 'Unnamed path'} · {Math.round(candidate.distanceMeters)} m
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
      {routing.pack ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.attribution}>
          Offline map{osmDate ? ` (${osmDate})` : ''} · {routing.pack.manifest.attribution}
        </ThemedText>
      ) : null}
      {compact && candidates.length === 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: true }}
          onPress={() => setExpanded(false)}
          hitSlop={8}
          style={styles.collapse}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Show less
          </ThemedText>
          <Ionicons name="chevron-up" size={16} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  text: {
    flex: 1,
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  choice: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
  },
  attribution: {
    fontSize: 11,
  },
  collapse: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: Spacing.one,
  },
});
