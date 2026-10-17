import { ANNOUNCEMENT_CATEGORY_META, formatDateTime, type AnnouncementCategory } from '@barangayan/shared';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image } from 'react-native';
import { Action, Body, Card, Destination, EmptyState, Notice, ResourceState, Screen } from '../../../../components/ui';
import { useReportCounts } from '../../../../data/report-counts';
import { useApi } from '../../../../data/use-api';
import { useResource } from '../../../../data/use-resource';
import { announcementImage } from '../../../../features/reports/media';
import { useReadActions } from '../../../../features/reports/use-read-actions';
import { useResident } from '../../../../lib/runtime';
import { radius, useColors } from '../../../../lib/theme';

export default function Announcement() {
  const { announcementId } = useLocalSearchParams();
  const api = useApi();
  const colors = useColors();
  const { session } = useResident();
  const { refresh: refreshCounts } = useReportCounts();
  const resource = useResource(`announcement:${announcementId}`, (signal) => api.announcement(announcementId, signal));
  const { actions, state } = useReadActions(async () => { await resource.refresh(); refreshCounts(); });
  const [imageFailed, setImageFailed] = useState(false);
  const item = resource.data;
  const image = item ? announcementImage(item.image_url) : null;
  const category = item && item.category in ANNOUNCEMENT_CATEGORY_META ? ANNOUNCEMENT_CATEGORY_META[item.category as AnnouncementCategory].label : item?.category;
  const read = item && session ? state.announcements[item.id] ?? item.read : null;
  return <Screen><ResourceState loading={resource.loading} error={resource.error} retry={() => void resource.refresh()} />
    {item === null && <EmptyState title="Announcement unavailable" message="This announcement was removed or is not published for your barangay."><Destination title="Back to Reports" href={{ pathname: '/reports', params: { segment: 'announcements' } }} /></EmptyState>}
    {item && <Card><Body heading>{item.title}</Body><Body role="footnote" tone="secondary">{`${category} · ${formatDateTime(item.published_at)}`}</Body>
      {image && !imageFailed && <Image source={{ uri: image }} accessibilityLabel="Announcement image" accessibilityIgnoresInvertColors resizeMode="cover" onError={() => setImageFailed(true)}
        style={{ height: 200, borderRadius: radius.md, backgroundColor: colors.surfaceSelected }} />}
      {image && imageFailed && <Body role="footnote" tone="secondary">The image could not be loaded.</Body>}
      <Body>{item.body}</Body>{item.detailed_description && <Body>{item.detailed_description}</Body>}
      {read !== null && <Action label={state.busy ? 'Saving…' : read ? 'Mark as unread' : 'Mark as read'} secondary disabled={state.busy} onPress={() => void actions.setAnnouncementRead(item.id, !read)} />}
      {!!state.message && <Notice message={state.message} tone={state.failed ? 'danger' : 'primary'} />}</Card>}
  </Screen>;
}
