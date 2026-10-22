import Svg, { Path } from 'react-native-svg';

/** Rounded open-roof house outline matching the supplied Home icon. */
export function HomeTabIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Path d="M2 12 12 2 22 12M4.3 13.05v6.6A2.35 2.35 0 0 0 6.65 22H9v-6.2a1.9 1.9 0 0 1 1.9-1.9h2.2a1.9 1.9 0 0 1 1.9 1.9V22h2.35a2.35 2.35 0 0 0 2.35-2.35v-6.6"
        stroke={color} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
