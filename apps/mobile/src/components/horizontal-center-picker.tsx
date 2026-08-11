import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export interface CenterPickerItem {
  id: string;
  name: string;
}

export interface HorizontalCenterPickerProps {
  items: CenterPickerItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onShowAll: () => void;
}

export function HorizontalCenterPicker({
  items,
  selectedId,
  onSelect,
  onShowAll,
}: HorizontalCenterPickerProps) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  const handleSelect = (id: string) => {
    onSelect(id);
    const index = items.findIndex((item) => item.id === id);
    if (index >= 0 && scrollRef.current) {
      scrollRef.current.scrollTo({ x: index * 140, animated: true });
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        <Pressable
          onPress={onShowAll}
          style={[
            styles.chip,
            selectedId === null && { backgroundColor: theme.primary },
          ]}>
          <ThemedText
            type="small"
            style={[
              styles.chipText,
              selectedId === null ? { color: theme.onPrimary } : { color: theme.text },
            ]}>
            Show All Centers
          </ThemedText>
        </Pressable>

        {items.map((item) => {
          const isSelected = selectedId === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => handleSelect(item.id)}
              style={[
                styles.chip,
                isSelected && { backgroundColor: theme.primary },
              ]}>
              <ThemedText
                type="small"
                style={[
                  styles.chipText,
                  isSelected ? { color: theme.onPrimary } : { color: theme.text },
                ]}>
                {item.name}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Parent overlay handles spacing and background
  },
  scrollContent: {
    paddingHorizontal: 6,
    gap: 3,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: 'transparent',
    minWidth: 120,
    alignItems: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
