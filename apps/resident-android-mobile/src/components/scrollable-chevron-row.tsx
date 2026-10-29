import { Children, cloneElement, isValidElement, useEffect, useRef, useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { horizontalScrollEdges, horizontalScrollTarget } from '@/lib/horizontal-scroll';
import { ThemedText } from '@/components/themed-text';

interface ScrollableChevronRowProps {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Opt-in interactive controls; existing Settings rows keep their current presentation. */
  label?: string;
  /** Home-only full-card pages, with controls below content. Other modes are unchanged. */
  pageWidth?: number;
  onIndexChange?: (index: number) => void;
  /** Interactive rows only: a range within the first child to scroll into view whenever it changes. */
  reveal?: { x: number; width: number };
}

/**
 * Horizontal ScrollView wrapper that shows a filled chevron badge on whichever edge still
 * has content to scroll to — used by the Settings screen's App Theme accent-color swatches
 * and Font Style chips so both rows signal "there's more here" the same way. The badges are
 * solid (theme.primary background, white icon, drop shadow) rather than bare icons so
 * they read clearly over any swatch/chip color underneath.
 */
export function ScrollableChevronRow(props: ScrollableChevronRowProps) {
  if (props.label && props.pageWidth !== undefined) {
    // Geometry or membership changes restart at one complete card; ordinary refreshes retain position.
    const identity = JSON.stringify([props.pageWidth, Children.toArray(props.children).map((child, index) => isValidElement(child) ? child.key : index)]);
    return <PagedChevronRow key={identity} {...props} label={props.label} pageWidth={props.pageWidth} />;
  }
  return props.label ? <InteractiveChevronRow {...props} label={props.label} /> : <PassiveChevronRow {...props} />;
}

function PagedChevronRow({ children, contentContainerStyle, label, pageWidth, onIndexChange }: ScrollableChevronRowProps & { label: string; pageWidth: number }) {
  const { resident } = useTheme();
  const reducedMotion = useResidentReducedMotion(true);
  const scroll = useRef<ScrollView>(null);
  const items = Children.toArray(children);
  const [index, setIndex] = useState(0);
  const currentIndex = useRef(0);
  const pendingIndex = useRef<number | null>(null);
  const gap = StyleSheet.flatten(contentContainerStyle)?.gap;
  const stride = pageWidth + (typeof gap === 'number' ? gap : 0);
  useEffect(() => { onIndexChange?.(index); }, [index, onIndexChange]);
  function advance(direction: number) {
    const next = Math.max(0, Math.min(items.length - 1, (pendingIndex.current ?? currentIndex.current) + direction));
    pendingIndex.current = next;
    scroll.current?.scrollTo({ x: next * stride, animated: !reducedMotion });
  }
  return <View style={styles.wrap}>
    <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={contentContainerStyle} snapToInterval={stride} decelerationRate="fast"
      onScrollBeginDrag={() => { pendingIndex.current = null; }}
      onScroll={event => {
        const offset = event.nativeEvent.contentOffset.x;
        const next = Math.max(0, Math.min(items.length - 1, Math.round(offset / stride)));
        currentIndex.current = next;
        setIndex(next);
        if (pendingIndex.current !== null && Math.abs(offset - pendingIndex.current * stride) < 1) pendingIndex.current = null;
      }} scrollEventThrottle={16}>
      {items.map((child, itemIndex) => <View key={isValidElement(child) ? child.key : itemIndex} style={{ width: pageWidth }}
        accessibilityElementsHidden={itemIndex !== index} importantForAccessibility={itemIndex === index ? 'auto' : 'no-hide-descendants'}>
        {isValidElement<PressableProps>(child) ? cloneElement(child, {
          accessible: itemIndex === index, focusable: itemIndex === index, disabled: itemIndex !== index,
          importantForAccessibility: itemIndex === index ? 'auto' : 'no-hide-descendants',
          accessibilityElementsHidden: itemIndex !== index,
        }) : child}
      </View>)}
    </ScrollView>
    {items.length > 1 ? <View style={styles.pageControls}>
      {([-1, 1] as const).map(direction => {
        const disabled = direction < 0 ? index === 0 : index === items.length - 1;
        return <Pressable key={direction} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
          accessibilityLabel={`Scroll ${label} ${direction < 0 ? 'left' : 'right'}`} onPress={() => advance(direction)}
          style={({ pressed }) => [styles.pageButton, { backgroundColor: pressed ? resident.pressed : resident.card, borderColor: resident.controlBorder }]}>
          <Ionicons name={direction < 0 ? 'chevron-back' : 'chevron-forward'} size={20} color={disabled ? resident.muted : resident.text} accessible={false} />
        </Pressable>;
      })}
      <ThemedText accessibilityLiveRegion="polite" style={[styles.position, { color: resident.text }]}>{index + 1} of {items.length}</ThemedText>
    </View> : null}
  </View>;
}

function InteractiveChevronRow({ children, contentContainerStyle, label, reveal }: ScrollableChevronRowProps & { label: string }) {
  const { resident } = useTheme();
  const reducedMotion = useResidentReducedMotion(true);
  const scroll = useRef<ScrollView>(null);
  const metrics = useRef({ offset: 0, width: 0, content: 0, first: 0, firstX: 0 });
  useEffect(() => {
    if (!reveal) return;
    const { offset, width, content, firstX } = metrics.current;
    // Leave room for the 44 dp edge chevrons so the revealed range is never drawn under one.
    const start = firstX + reveal.x - 44;
    const end = firstX + reveal.x + reveal.width + 44;
    const target = start < offset ? start : end > offset + width ? end - width : offset;
    if (target !== offset) scroll.current?.scrollTo({ x: Math.max(0, Math.min(Math.max(0, content - width), target)), animated: !reducedMotion });
  }, [reveal, reducedMotion]);
  const [edges, setEdges] = useState({ left: false, right: false });
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
      onScroll={event => { metrics.current.offset = event.nativeEvent.contentOffset.x; update(); }} scrollEventThrottle={16}
      onContentSizeChange={width => { metrics.current.content = width; update(); }}
      onLayout={event => { metrics.current.width = event.nativeEvent.layout.width; update(); }}>
      {Children.map(children, (child, index) => <View onLayout={index === 0 ? event => {
        const width = event.nativeEvent.layout.width;
        metrics.current.first = width;
        metrics.current.firstX = event.nativeEvent.layout.x;
      } : undefined}>{child}</View>)}
    </ScrollView>
    {(['left', 'right'] as const).map(side => edges[side] ? <Pressable key={side} accessibilityRole="button"
      accessibilityLabel={`Scroll ${label} ${side}`} onPress={() => advance(side === 'left' ? -1 : 1)}
      style={[styles.arrowHit, side === 'left' ? { left: 4 } : { right: 4 }]}>
      <View style={[styles.arrowFace, { backgroundColor: resident.card, borderColor: resident.border }]}>
        <Ionicons name={side === 'left' ? 'chevron-back' : 'chevron-forward'} size={16} color={resident.text} accessible={false} />
      </View>
    </Pressable> : null)}
  </View>;
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
  pageControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 20 },
  pageButton: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  position: { fontSize: 13, lineHeight: 20, flexShrink: 1 },
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
