# Collapsible Fade-Out Animation Plan

## Goal
Add a fade-out animation when closing the collapsible registration detail in the health screen (my registration segment).

## Current State
- `Collapsible` component in `apps/mobile/src/components/ui/collapsible.tsx`
- Uses `FadeIn.duration(200)` for entering animation via `react-native-reanimated`
- Content conditionally rendered with `{isOpen && ...}` - causes immediate unmount on close
- No exit animation currently

## Problem
The conditional rendering `{isOpen && (...)}` unmounts the content instantly when `isOpen` becomes `false`, leaving no time for an exit animation to run.

## Solution Design

### Approach: Mount During Exit Animation
Keep content mounted while `exiting` animation runs, then unmount after completion.

### Implementation Steps

1. **Import `FadeOut`** from `react-native-reanimated`
2. **Replace conditional rendering** with always-mounted `Animated.View` that uses both `entering` and `exiting` props
3. **Control visibility** via `exiting` animation completion - the component handles unmounting internally when exit animation finishes
4. **Maintain chevron rotation animation** (already works via style transform)

### Code Changes

```tsx
// In collapsible.tsx
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

// Replace lines 32-38:
<Animated.View
  entering={FadeIn.duration(200)}
  exiting={FadeOut.duration(200)}
  style={styles.contentWrapper}
>
  <ThemedView type="backgroundElement" style={styles.content}>
    {children}
  </ThemedView>
</Animated.View>

// Add to styles:
contentWrapper: {
  overflow: 'hidden', // Ensure content clips during animation
},
```

**Key insight**: `react-native-reanimated`'s `Animated.View` with `exiting` prop automatically handles the mount/unmount lifecycle - it keeps the component mounted during the exit animation and unmounts it after completion. No manual state management needed.

## Validation
- Open collapsible → content fades in (200ms)
- Close collapsible → content fades out (200ms), chevron rotates back
- Rapid open/close → animations don't conflict
- Content accessibility preserved

## Risks
- **Layout shift**: Ensure `overflow: 'hidden'` on wrapper prevents layout jumps during fade
- **Nested collapsibles**: Test if multiple collapsibles work independently (each manages own state)

## Out of Scope
- Height-based collapse animation (slide down/up) - would require `LayoutAnimation` or `useSharedValue` + `withTiming`
- Persist open state across navigation