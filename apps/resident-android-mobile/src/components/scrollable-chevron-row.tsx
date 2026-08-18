import { useRef, useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

interface ScrollableChevronRowProps {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

/**
 * Horizontal ScrollView wrapper that shows a filled chevron badge on whichever edge still
 * has content to scroll to — used by the Settings screen's App Theme accent-color swatches
 * and Font Style chips so both rows signal "there's more here" the same way. The badges are
 * solid (theme.primary background, white icon, drop shadow) rather than bare icons so
 * they read clearly over any swatch/chip color underneath.
 */
export function ScrollableChevronRow({ children, contentContainerStyle }: ScrollableChevronRowProps) {
  const theme = useTheme();
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const contentWidth = useRef(0);
  const layoutWidth = useRef(0);

  function updateScrollState(offsetX: number) {
    setCanScrollLeft(offsetX > 4);
    setCanScrollRight(offsetX < contentWidth.current - layoutWidth.current - 4);
  }

  function handleScroll(event: { nativeEvent: { contentOffset: { x: number } } }) {
    updateScrollState(event.nativeEvent.contentOffset.x);
  }

  function handleContentSizeChange(width: number) {
    contentWidth.current = width;
    updateScrollState(0);
  }

  function handleLayout(event: { nativeEvent: { layout: { width: number } } }) {
    layoutWidth.current = event.nativeEvent.layout.width;
    updateScrollState(0);
  }

  return (
    <View style={styles.wrap}>
      {canScrollLeft ? (
        <View style={[styles.chevron, styles.chevronLeft, { backgroundColor: theme.primary }]} pointerEvents="none">
          <Ionicons name="chevron-back" size={18} color="#ffffff" />
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={contentContainerStyle}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onContentSizeChange={handleContentSizeChange}
        onLayout={handleLayout}>
        {children}
      </ScrollView>

      {canScrollRight ? (
        <View style={[styles.chevron, styles.chevronRight, { backgroundColor: theme.primary }]} pointerEvents="none">
          <Ionicons name="chevron-forward" size={18} color="#ffffff" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  chevron: {
    position: 'absolute',
    top: '50%',
    marginTop: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  chevronLeft: {
    left: -6,
  },
  chevronRight: {
    right: -6,
  },
});
