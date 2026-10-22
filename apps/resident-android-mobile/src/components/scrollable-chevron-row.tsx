import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { horizontalScrollEdges, horizontalScrollTarget } from '@/lib/horizontal-scroll';

interface ScrollableChevronRowProps {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Opt-in interactive controls; existing Settings rows keep their current presentation. */
  label?: string;
  /** Home shelves snap by the measured first card plus their gap. */
  snapToItems?: boolean;
}

/**
 * Horizontal ScrollView wrapper that shows a filled chevron badge on whichever edge still
 * has content to scroll to — used by the Settings screen's App Theme accent-color swatches
 * and Font Style chips so both rows signal "there's more here" the same way. The badges are
 * solid (theme.primary background, white icon, drop shadow) rather than bare icons so
 * they read clearly over any swatch/chip color underneath.
 */
export function ScrollableChevronRow(props: ScrollableChevronRowProps) {
  return props.label ? <InteractiveChevronRow {...props} label={props.label} /> : <PassiveChevronRow {...props} />;
}

function InteractiveChevronRow({ children, contentContainerStyle, label, snapToItems = false }: ScrollableChevronRowProps & { label: string }) {
  const { resident } = useTheme();
  const reducedMotion = useResidentReducedMotion(true);
  const scroll = useRef<ScrollView>(null);
  const metrics = useRef({ offset: 0, width: 0, content: 0, first: 0 });
  const [edges, setEdges] = useState({ left: false, right: false });
  const [itemWidth, setItemWidth] = useState(0);
  const gap = StyleSheet.flatten(contentContainerStyle)?.gap;
  const itemGap = typeof gap === 'number' ? gap : 0;
  function update() {
    const { offset, width, content } = metrics.current;
    const { left, right } = horizontalScrollEdges(offset, width, content);
    setEdges(current => current.left === left && current.right === right ? current : { left, right });
  }
  function advance(direction: number) {
    const step = metrics.current.first + itemGap;
    scroll.current?.scrollTo({ x: horizontalScrollTarget(metrics.current.offset, metrics.current.width, metrics.current.content, step, direction), animated: !reducedMotion });
  }
  return <View style={styles.wrap}>
    <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={contentContainerStyle}
      snapToInterval={snapToItems && itemWidth > 0 ? itemWidth + itemGap : undefined}
      decelerationRate={snapToItems ? 'fast' : 'normal'}
      onScroll={event => { metrics.current.offset = event.nativeEvent.contentOffset.x; update(); }} scrollEventThrottle={16}
      onContentSizeChange={width => { metrics.current.content = width; update(); }}
      onLayout={event => { metrics.current.width = event.nativeEvent.layout.width; update(); }}>
      {Children.map(children, (child, index) => <View onLayout={index === 0 ? event => {
        const width = event.nativeEvent.layout.width;
        metrics.current.first = width;
        if (snapToItems) setItemWidth(previous => previous === width ? previous : width);
      } : undefined}>{child}</View>)}
    </ScrollView>
    {(['left', 'right'] as const).map(side => snapToItems ? <ShelfChevron key={side} side={side} visible={edges[side]} label={label}
      reducedMotion={reducedMotion} onPress={() => advance(side === 'left' ? -1 : 1)} /> : edges[side] ? <Pressable key={side} accessibilityRole="button"
      accessibilityLabel={`Scroll ${label} ${side}`} onPress={() => advance(side === 'left' ? -1 : 1)}
      style={[styles.arrowHit, side === 'left' ? { left: 4 } : { right: 4 }]}>
      <View style={[styles.arrowFace, { backgroundColor: resident.card, borderColor: resident.border }]}>
        <Ionicons name={side === 'left' ? 'chevron-back' : 'chevron-forward'} size={16} color={resident.text} accessible={false} />
      </View>
    </Pressable> : null)}
  </View>;
}

/** Home keeps the reference's 200ms edge fade without leaving hidden touch/focus targets. */
function ShelfChevron({ side, visible, label, reducedMotion, onPress }: {
  side: 'left' | 'right'; visible: boolean; label: string; reducedMotion: boolean; onPress: () => void;
}) {
  const { resident } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(opacity, { toValue: Number(visible), duration: reducedMotion ? 100 : 200,
      easing: Easing.bezier(0, 0, 0.58, 1), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [visible, reducedMotion, opacity]);
  return <Animated.View pointerEvents={visible ? 'auto' : 'none'} accessibilityElementsHidden={!visible}
    importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    style={[styles.arrowHit, side === 'left' ? { left: 2 } : { right: 2 }, { opacity }]}>
    <Pressable disabled={!visible} accessibilityRole="button" accessibilityLabel={`Scroll ${label} ${side}`} onPress={onPress}
      style={styles.arrowButton}>
      <View style={[styles.arrowFace, { backgroundColor: resident.card, borderColor: resident.border }]}>
        <Ionicons name={side === 'left' ? 'chevron-back' : 'chevron-forward'} size={16} color={resident.text} accessible={false} />
      </View>
    </Pressable>
  </Animated.View>;
}

function PassiveChevronRow({ children, contentContainerStyle }: ScrollableChevronRowProps) {
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
  arrowButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  arrowHit: { position: 'absolute', zIndex: 1, elevation: 4, top: '50%', marginTop: -22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  arrowFace: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
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
