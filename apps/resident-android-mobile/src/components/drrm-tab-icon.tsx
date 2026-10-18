import Svg, { Path } from 'react-native-svg';

/** Emergency phone with a medical cross, tinted by the tab's selection state. */
export function DrrmTabIcon({ color, size = 23 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="12 12 192 192" accessible={false} fill={color}>
      <Path d="M45 33C28 39 20 54 21 73c2 26 19 55 44 81 25 25 53 41 79 43 19 1 35-8 42-25 3-8 1-14-7-18l-27-15c-7-4-13-3-18 3l-7 7c-4 4-9 3-15 0-17-9-34-26-44-43-4-6-4-11 0-15l9-8c5-5 6-11 2-18L66 39c-5-8-12-9-21-6Z" />
      <Path d="M148 23h7c7 0 11 4 11 11v19h19c7 0 11 4 11 11v7c0 7-4 11-11 11h-19v19c0 7-4 11-11 11h-7c-7 0-11-4-11-11V82h-19c-7 0-11-4-11-11v-7c0-7 4-11 11-11h19V34c0-7 4-11 11-11Z" />
    </Svg>
  );
}
