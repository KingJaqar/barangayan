import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

export interface AccordionItem {
  title: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  content: string[];
}

interface Props {
  items: AccordionItem[];
}

export function EmergencyAccordion({ items }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function handleToggle(index: number) {
    setOpenIndex((prev) => (prev === index ? null : index));
  }

  return (
    <View style={styles.container}>
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <View key={index} style={[styles.item, index < items.length - 1 && styles.itemBorder]}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              accessibilityLabel={`${item.title} guidelines`}
              onPress={() => handleToggle(index)}
              style={styles.itemHeader}
              hitSlop={Spacing.one}
            >
              <View style={[styles.iconCircle, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon as any} size={22} color={item.iconColor} />
              </View>
              <ThemedText type="smallBold" style={styles.itemTitle}>
                {item.title}
              </ThemedText>
              <View style={styles.chevronWrapper}>
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color="#60646C"
                  style={[styles.chevron, isOpen && styles.chevronOpen]}
                />
              </View>
            </Pressable>

            {isOpen && (
              <View style={styles.contentWrapper}>
                {item.content.map((step, stepIndex) => (
                  <View key={stepIndex} style={styles.stepRow}>
                    <View style={styles.bullet} />
                    <ThemedText type="small" style={styles.stepText}>
                      {step}
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  item: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F3',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  chevronWrapper: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    transform: [{ rotate: '0deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  contentWrapper: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#60646C',
    marginTop: 6,
    marginLeft: 3,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: '#60646C',
    lineHeight: 19,
  },
});