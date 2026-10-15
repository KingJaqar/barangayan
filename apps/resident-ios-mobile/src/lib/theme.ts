import { useColorScheme, type TextStyle } from 'react-native';

/** Semantic colors from the Design System Handoff Rev 2.1 §5. Status colors never change with accent preferences. */
const lightColors = {
  canvas: '#F7F8F7',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceSelected: '#E8F4EF',
  textPrimary: '#171D1A',
  textSecondary: '#45534E',
  textTertiary: '#61716B',
  border: '#CDD8D2',
  primary: '#0D6B59',
  onPrimary: '#FFFFFF',
  success: '#147A3E',
  warning: '#8A5A00',
  danger: '#B42318',
  info: '#075BAA',
  focus: '#0A70D1',
  overlay: 'rgba(23,29,26,0.36)',
};
export type Colors = typeof lightColors;
const darkColors: Colors = {
  canvas: '#101614',
  surface: '#18201D',
  surfaceRaised: '#202A26',
  surfaceSelected: '#16382F',
  textPrimary: '#F3F7F4',
  textSecondary: '#B9C7C0',
  textTertiary: '#8EA19A',
  border: '#3A4A43',
  primary: '#35C7A0',
  onPrimary: '#06251D',
  success: '#5DDB8B',
  warning: '#FFD37A',
  danger: '#FF8B82',
  info: '#7FC4FF',
  focus: '#88C7FF',
  overlay: 'rgba(0,0,0,0.52)',
};

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? darkColors : lightColors;
}

/** iOS points. Font sizes scale with Dynamic Type through React Native's default font scaling. */
export const typeScale = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 23, fontWeight: '400' },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  subheadline: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  monoReference: { fontSize: 15, lineHeight: 20, fontFamily: 'Menlo' },
} satisfies Record<string, TextStyle>;
export type TypeRole = keyof typeof typeScale;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const layout = { margin: 20, listRowMin: 56, controlMin: 44, buttonMinHeight: 50 } as const;
