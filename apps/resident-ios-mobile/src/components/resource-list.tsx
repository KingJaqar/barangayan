import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import type { ReactNode } from 'react';
import { Action, Body, EmptyState, ErrorState, Skeleton } from './ui';
import { listPresentation, type PagedState } from '../data/pagination';
import { residentError } from '../lib/errors';
import { formatRelativeTime } from '../lib/format';
import { layout, space, useColors } from '../lib/theme';

/**
 * Incrementally paged list (plan P02-T03). `filtered` selects the no-results copy instead of
 * the true-empty copy. Confirmed rows stay visible and are labelled stale when a refresh fails.
 */
export function ResourceList<T extends { id: string }>({ resource, render, header, empty, noResults, filtered = false }: {
  resource: { state: PagedState<T>; reload: () => Promise<void>; loadMore: () => Promise<void>; retry: () => Promise<void> };
  render: (item: T) => ReactNode;
  header?: ReactNode;
  empty: { title: string; message: string };
  noResults?: { title: string; message: string };
  filtered?: boolean;
}) {
  const colors = useColors();
  const { state } = resource;
  const presentation = listPresentation(state, filtered);
  const failedMore = state.status === 'error' && state.items.length > 0 && !state.stale;
  return <FlatList data={state.items} keyExtractor={(item) => item.id} renderItem={({ item }) => <View style={{ marginBottom: space[3] }}>{render(item)}</View>}
    contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" style={{ backgroundColor: colors.canvas }} contentContainerStyle={{ padding: layout.margin, paddingBottom: space[7] }}
    onEndReachedThreshold={0.5} onEndReached={() => void resource.loadMore()}
    refreshControl={<RefreshControl refreshing={state.status === 'refreshing'} onRefresh={() => void resource.reload()} />}
    ListHeaderComponent={<View style={{ gap: space[4], paddingBottom: space[4] }}>
      {header}
      {presentation === 'loading' && <Skeleton />}
      {presentation === 'error' && <ErrorState message={residentError(state.error)} retry={() => void resource.retry()} />}
      {state.stale && <View accessibilityRole="alert" style={{ gap: space[2] }}>
        <Body role="footnote" tone="danger">{`These results could not be refreshed and may be out of date (last updated: ${state.fetchedAt ? formatRelativeTime(new Date(state.fetchedAt).toISOString()) : 'unknown'}). ${residentError(state.error)}`}</Body>
        <Action label="Try again" secondary onPress={() => void resource.retry()} />
      </View>}
    </View>}
    ListEmptyComponent={presentation === 'empty' ? <EmptyState title={empty.title} message={empty.message} />
      : presentation === 'no-results' ? <EmptyState title={noResults?.title ?? 'No results'} message={noResults?.message ?? 'Try a different search.'} /> : null}
    ListFooterComponent={state.status === 'loading-more' ? <ActivityIndicator accessibilityLabel="Loading more" style={{ padding: space[4] }} />
      : failedMore ? <View style={{ gap: space[2] }}><Body role="footnote" tone="danger">{`More results could not be loaded. ${residentError(state.error)}`}</Body><Action label="Load more" secondary onPress={() => void resource.retry()} /></View>
      : null} />;
}
