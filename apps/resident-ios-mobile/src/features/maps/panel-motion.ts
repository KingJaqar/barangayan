import { Animated, PanResponder, type PanResponderInstance } from 'react-native';
import { settlesCollapsed } from './panel-gesture';

/**
 * Expand/collapse state and motion of the DRRM panel. A tap on the handle (`toggle`) is the
 * accessible action; the drag only follows it. Reduced motion jumps instead of springing.
 */
export class PanelMotion {
  readonly offset = new Animated.Value(0);
  readonly responder: PanResponderInstance;
  private collapsed = false;
  private height = 0;
  private reduceMotion = false;

  constructor(private readonly onChange: (collapsed: boolean) => void) {
    this.responder = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6,
      onPanResponderMove: (_, gesture) => {
        const base = this.collapsed ? this.height : 0;
        this.offset.setValue(Math.max(0, Math.min(this.height, base + gesture.dy)));
      },
      onPanResponderRelease: (_, gesture) => this.settle(settlesCollapsed(this.collapsed, gesture.dy, gesture.vy)),
      onPanResponderTerminate: () => this.settle(this.collapsed),
    });
  }

  setReduceMotion(value: boolean): void {
    this.reduceMotion = value;
  }

  /** Called with the measured height of the shortcut content; a collapsed panel stays fully tucked away. */
  measured(height: number): void {
    this.height = height;
    if (this.collapsed) this.offset.setValue(height);
  }

  toggle(): void {
    this.settle(!this.collapsed);
  }

  private settle(collapsed: boolean): void {
    this.collapsed = collapsed;
    this.onChange(collapsed);
    const target = collapsed ? this.height : 0;
    if (this.reduceMotion) this.offset.setValue(target);
    else Animated.spring(this.offset, { toValue: target, bounciness: 2, speed: 14, useNativeDriver: true }).start();
  }
}
