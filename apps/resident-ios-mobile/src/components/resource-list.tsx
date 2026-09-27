import { FlatList, RefreshControl, View } from 'react-native';
import type { ReactNode } from 'react';
import { Body, ResourceState, usePalette } from './ui';
export function ResourceList<T extends { id: string }>({ resource, render, header, empty = 'Nothing to show yet.' }: {
  resource: { data?: T[]; loading: boolean; error?: string; refresh: () => Promise<void> };
  render: (item: T) => ReactNode;
  header?: ReactNode;
  empty?: string;
}) {
  const palette = usePalette();
  return <FlatList data={resource.data ?? []} keyExtractor={(item) => item.id} renderItem={({ item }) => <View style={{ marginBottom: 14 }}>{render(item)}</View>}
    contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" style={{ backgroundColor: palette.background }} contentContainerStyle={{ padding: 20, paddingBottom: 36 }}
    refreshControl={<RefreshControl refreshing={resource.loading && !!resource.data} onRefresh={() => void resource.refresh()} />}
    ListHeaderComponent={<View style={{ gap: 16, paddingBottom: 16 }}>{header}<ResourceState loading={resource.loading && !resource.data} error={resource.error} retry={() => void resource.refresh()} /></View>}
    ListEmptyComponent={!resource.loading && !resource.error && resource.data ? <Body>{empty}</Body> : null} />;
}
