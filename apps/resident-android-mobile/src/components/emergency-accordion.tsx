import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

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
  const theme = useTheme();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function handleToggle(index: number) {
    setOpenIndex((prev) => (prev === index ? null : index));
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <View
            key={index}
            style={[
              styles.item,
              index < items.length - 1 && [styles.itemBorder, { borderBottomColor: theme.backgroundSelected }],
            ]}>
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
                  color={theme.textSecondary}
                  style={[styles.chevron, isOpen && styles.chevronOpen]}
                />
              </View>
            </Pressable>

            {isOpen && (
              <View style={styles.contentWrapper}>
                {item.content.map((step, stepIndex) => (
                  <View key={stepIndex} style={styles.stepRow}>
                    <View style={[styles.bullet, { backgroundColor: theme.textSecondary }]} />
                    <ThemedText type="small" themeColor="textSecondary" style={styles.stepText}>
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
    borderWidth: 1,
    overflow: 'hidden',
  },
  item: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  itemBorder: {
    borderBottomWidth: 1,
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
    marginTop: 6,
    marginLeft: 3,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
});