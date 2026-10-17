import type { AttachmentCandidate } from '@barangayan/shared/src/lib/evacuation-routing';
import { ActivityIndicator, View } from 'react-native';
import { Action, Body, Card, SymbolIcon } from '../../components/ui';
import { space, useColors } from '../../lib/theme';
import type { RouteDescription } from './route-copy';

/**
 * The route service in words: what the walking route is based on, how fresh it is and every failure, with the street
 * chooser and a retry. It is a live region, so VoiceOver hears a change of state without a tap.
 */
export function RouteCard({ description, onChooseSegment, onRetry }: {
  description: RouteDescription; onChooseSegment: (candidate: AttachmentCandidate, graphVersion: string) => void; onRetry: () => void;
}) {
  const colors = useColors();
  if (description.lines.length === 0 && description.summary === null) return null;
  const graphVersion = description.graphVersion;
  return <Card>
    <View accessibilityLiveRegion="polite" style={{ gap: space[2] }}>
      {description.summary !== null && <Body heading role="headline">{description.summary}</Body>}
      {description.lines.map((line) => <View key={line.text} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
        {line.busy ? <ActivityIndicator /> : <SymbolIcon name={line.tone === 'info' ? 'info.circle' : 'exclamationmark.triangle'} color={line.tone === 'info' ? colors.primary : colors.warning} size={16} />}
        <View style={{ flex: 1 }}><Body role="subheadline">{line.text}</Body></View>
      </View>)}
    </View>
    {description.candidates.length > 0 && graphVersion !== null && description.candidates.map((candidate) =>
      <Action key={candidate.edgeId} secondary label={`${candidate.name ?? 'Unnamed path'} · ${Math.round(candidate.distanceMeters)} m`} onPress={() => onChooseSegment(candidate, graphVersion)} />)}
    {description.retryable && <Action label="Try again" secondary onPress={onRetry} />}
    {description.attribution !== null && <Body role="caption" tone="secondary">{description.attribution}</Body>}
  </Card>;
}
