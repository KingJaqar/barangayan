import { useEffect, useRef } from 'react';
import { LayoutChangeEvent, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface CenterPickerItem {
  id: string;
  name: string;
  /** Walking distance in km from the resident's current position, when known. */
  distanceKm?: number;
}

export interface HorizontalCenterPickerProps {
  items: CenterPickerItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onShowAll: () => void;
}

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

export function HorizontalCenterPicker({
  items,
  selectedId,
  onSelect,
  onShowAll,
}: HorizontalCenterPickerProps) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  // Chips are variable-width text pills, so remember each one's measured x offset
  // (rather than assuming a fixed card width) to scroll the right one into view.
  const offsetsRef = useRef<Record<string, number>>({});
  const isAllSelected = selectedId === null;

  useEffect(() => {
    if (isAllSelected) scrollRef.current?.scrollTo({ x: 0, animated: true });
  }, [isAllSelected]);

  const handleSelect = (id: string) => {
    onSelect(id);
    const x = offsetsRef.current[id];
    if (x !== undefined && scrollRef.current) {
      scrollRef.current.scrollTo({ x: Math.max(0, x - 12), animated: true });
    }
  };

  const registerOffset = (id: string) => (e: LayoutChangeEvent) => {
    offsetsRef.current[id] = e.nativeEvent.layout.x;
  };

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}>
      <Pressable
        onPress={onShowAll}
        style={[
          styles.chip,
          {
            backgroundColor: isAllSelected ? theme.primary : theme.background,
            borderColor: isAllSelected ? theme.primary : theme.backgroundSelected,
          },
        ]}>
        <ThemedText
          type="smallBold"
          style={{ color: isAllSelected ? theme.onPrimary : theme.text }}>
          All
        </ThemedText>
      </Pressable>

      {items.map((item) => {
        const isSelected = selectedId === item.id;
        return (
          <Pressable
            key={item.id}
            onLayout={registerOffset(item.id)}
            onPress={() => handleSelect(item.id)}
            style={[
              styles.chip,
              styles.centerChip,
              {
                backgroundColor: isSelected ? theme.primary : theme.background,
                borderColor: isSelected ? theme.primary : theme.backgroundSelected,
              },
            ]}>
            <ThemedText
              type="smallBold"
              numberOfLines={1}
              style={[styles.chipName, { color: isSelected ? theme.onPrimary : theme.text }]}>
              {item.name}
            </ThemedText>
            {item.distanceKm !== undefined ? (
              <ThemedText
                type="small"
                style={[
                  styles.chipDistance,
                  { color: isSelected ? 'rgba(255,255,255,0.8)' : theme.textSecondary },
                ]}>
                {formatDistance(item.distanceKm)}
              </ThemedText>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chip: {
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  centerChip: {
    flexDirection: 'row',
    gap: 5,
  },
  chipName: {
    fontSize: 13,
    lineHeight: 16,
    maxWidth: 160,
  },
  chipDistance: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
});
