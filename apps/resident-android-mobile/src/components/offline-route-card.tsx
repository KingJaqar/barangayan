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
    case 'failed':
      return { text: 'Walking route could not be calculated. Reopen Centers to retry.', tone: 'warning' };
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
  dense = false,
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
  /** List layout: keep all details visible with tighter spacing and typography. */
  dense?: boolean;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(dense);

  if (routing.phase === 'loading') {
    return (
      <View style={[styles.card, dense && styles.denseCard, compact && styles.compactCard, { backgroundColor: theme.resident.card, borderColor: theme.resident.border }, style]}>
        <View style={[styles.row, compact && styles.statusToggle]}>
          <ActivityIndicator size="small" color={theme.resident.accentText} />
          <ThemedText type="small" style={dense && styles.denseText}>Loading the offline map…</ThemedText>
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
    if (routing.pendingUpdate) lines.push({ text: `A newer map is waiting: ${DEFERRAL_TEXT[routing.pendingUpdate.reason]}.`, tone: 'warning' });
    if (routing.unresolvedAvoidanceIds.length > 0) lines.push({ text: 'Some saved blocked roads do not match this map. Review your blocked roads before routing.', tone: 'warning' });
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
  const conditionsWarning = lines.some(line => line.tone === 'warning');

  // On the map, keep status indicators visible and put full diagnostics behind Show.
  // Required street choices still open automatically so routing can continue.
  const statusToggle = (open: boolean) => <Pressable accessibilityRole="button"
    accessibilityLabel={open ? 'Hide routing status' : 'Show full routing status'} accessibilityState={{ expanded: open }}
    accessibilityHint={message?.text ?? lines.find(line => line.tone === 'warning')?.text ?? 'View road conditions and routing details'}
    onPress={() => setExpanded(!open)} style={[styles.row, styles.statusToggle]}>
    <View style={[styles.statusIndicators, { backgroundColor: conditionsWarning || message?.tone === 'warning' ? theme.resident.dangerSoft : theme.resident.accentSoft }]}>
      {lines.length > 0 ? <Ionicons accessible accessibilityLabel={conditionsWarning ? 'Road conditions need attention' : 'Road conditions checked'} name={conditionsWarning ? 'cloud-offline-outline' : 'cloud-done-outline'} size={16} color={conditionsWarning ? theme.resident.danger : theme.resident.accentText} /> : null}
      {message?.busy || connectedPending ? <ActivityIndicator accessibilityLabel="Checking route" size="small" color={theme.resident.accentText} /> : message ? <Ionicons accessible accessibilityLabel={message.text} name={message.tone === 'warning' ? 'alert-circle-outline' : 'walk-outline'} size={16} color={message.tone === 'warning' ? theme.resident.danger : theme.resident.accentText} /> : null}
    </View>
    <ThemedText type="smallBold" style={open ? styles.text : styles.statusTitle}>Routing status</ThemedText>
    <View style={styles.statusAction}>
      <ThemedText type="smallBold" style={{ color: theme.resident.accentText }}>{open ? 'Hide' : 'Show'}</ThemedText>
      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={theme.resident.accentText} />
    </View>
  </Pressable>;
  if (compact && !expanded && candidates.length === 0) {
    return <View accessibilityLiveRegion="polite" style={[styles.card, styles.compactCard, { backgroundColor: theme.resident.card, borderColor: theme.resident.border }, style]}>
      {statusToggle(false)}
    </View>;
  }
  // The list keeps warning text readable even when informational details collapse.
  if ((compact || dense) && !expanded && candidates.length === 0) {
    const warnings = lines.filter(line => line.tone === 'warning');
    if (message?.tone === 'warning') warnings.push(message);
    return <View accessibilityLiveRegion="polite" style={[styles.card, { backgroundColor: theme.resident.card, borderColor: theme.resident.border }, style]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Show full routing status" accessibilityState={{ expanded: false }}
        onPress={() => setExpanded(true)} style={[styles.row, { minHeight: 44 }]}>
        <Ionicons name="information-circle-outline" size={18} color={theme.resident.accentText} />
        <ThemedText type="smallBold" style={styles.text}>Routing status</ThemedText>
        <ThemedText type="smallBold" style={{ color: theme.resident.accentText }}>Show</ThemedText>
        <Ionicons name="chevron-down" size={16} color={theme.resident.muted} />
      </Pressable>
      {warnings.map(line => <View key={line.text} style={[styles.row, { alignItems: 'flex-start' }]}>
        <Ionicons name="alert-circle-outline" size={16} color={theme.resident.danger} />
        <ThemedText type="small" style={[styles.text, { color: theme.resident.text }]}>{line.text}</ThemedText>
      </View>)}
      {message?.busy ? <View style={styles.row}><ActivityIndicator color={theme.resident.accentText} /><ThemedText type="small" style={styles.text}>{message.text}</ThemedText></View> : null}
    </View>;
  }

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.card, dense && styles.denseCard, compact && styles.mapDetailsCard, { backgroundColor: theme.resident.card, borderColor: theme.resident.border }, style]}>
      {compact && candidates.length === 0 ? statusToggle(true) : null}
      {lines.map(line => (
        <View key={line.text} style={[styles.row, dense && styles.denseRow, compact && styles.mapDetailRow, compact && { backgroundColor: line.tone === 'warning' ? theme.resident.dangerSoft : theme.resident.surface }]}>
          <Ionicons name={line.tone === 'info' ? 'cloud-done-outline' : 'cloud-offline-outline'} size={16} color={line.tone === 'info' ? theme.resident.accentText : theme.resident.danger} />
          <ThemedText type="small" style={[styles.text, dense && styles.denseText]}>
            {line.text}
          </ThemedText>
        </View>
      ))}
      {message ? (
        <View style={[styles.row, dense && styles.denseRow, compact && styles.mapDetailRow, compact && { backgroundColor: message.tone === 'warning' ? theme.resident.dangerSoft : theme.resident.accentSoft }]}>
          {message.busy ? (
            <ActivityIndicator size="small" color={theme.resident.accentText} />
          ) : (
            <Ionicons name={message.tone === 'info' ? 'walk-outline' : 'alert-circle-outline'} size={16} color={message.tone === 'info' ? theme.resident.accentText : theme.resident.danger} />
          )}
          <ThemedText type="smallBold" style={[styles.text, dense && styles.denseText, dense && styles.denseMessage]}>
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
              <ThemedText type="smallBold" style={{ color: theme.resident.accentText }}>
                {candidate.name ?? 'Unnamed path'} · {Math.round(candidate.distanceMeters)} m
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
      {routing.pack ? (
        <ThemedText type="small" themeColor="textSecondary" style={[styles.attribution, dense && styles.denseAttribution]}>
          Offline map{osmDate ? ` (${osmDate})` : ''} · {routing.pack.manifest.attribution}
        </ThemedText>
      ) : null}
      {dense && candidates.length === 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hide routing status"
          accessibilityState={{ expanded: true }}
          onPress={() => setExpanded(false)}
          hitSlop={8}
          style={styles.collapse}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Hide routing status
          </ThemedText>
          <Ionicons name="chevron-up" size={16} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  compactCard: { paddingVertical: 0, paddingHorizontal: Spacing.two, alignSelf: 'flex-start', maxWidth: '100%', borderRadius: 24 },
  statusToggle: { minHeight: 44, flexWrap: 'nowrap', alignItems: 'center', paddingVertical: Spacing.one, gap: Spacing.two },
  statusTitle: { flexShrink: 1 },
  statusIndicators: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.one, padding: Spacing.one, borderRadius: 12, flexShrink: 0 },
  statusAction: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, flexShrink: 0 },
  mapDetailsCard: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.two, gap: Spacing.one },
  mapDetailRow: { alignItems: 'flex-start', padding: Spacing.two, borderRadius: 12, gap: Spacing.two },
  denseCard: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  denseRow: {
    alignItems: 'flex-start',
    gap: 6,
  },
  denseText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  denseMessage: {
    fontWeight: '600',
  },
  denseAttribution: {
    lineHeight: 15,
    fontWeight: '400',
  },
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
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
  },
  attribution: {
    fontSize: 11,
  },
  collapse: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: Spacing.one,
  },
});
