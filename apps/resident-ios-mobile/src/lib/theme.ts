import { createContext, useContext, useMemo } from 'react';
import { useColorScheme, type TextStyle } from 'react-native';
import { derivePalette, type Colors } from './palette';

export type { Colors } from './palette';

/** The resident's accent color (null = the handoff's default tokens). Provided by the appearance provider. */
export const AccentContext = createContext<string | null>(null);
/** The resident's chosen iOS font family (undefined = the system face). Provided by the appearance provider. */
export const FontFamilyContext = createContext<string | undefined>(undefined);

/**
 * Semantic colors for the active scheme. The scheme follows the system or the resident's
 * Light/Dark choice (applied natively through `Appearance.setColorScheme`), and the accent
 * overlays action/selection tokens only.
 */
export function useColors(): Colors {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const accent = useContext(AccentContext);
  return useMemo(() => derivePalette(scheme, accent), [scheme, accent]);
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

/**
 * The type scale with the resident's font family applied. Family changes only the face; size,
 * weight and line height stay the semantic roles. References keep their monospaced face.
 */
export function useType(): Record<TypeRole, TextStyle> {
  const fontFamily = useContext(FontFamilyContext);
  return useMemo(() => {
    if (!fontFamily) return typeScale;
    const styled: Record<string, TextStyle> = {};
    for (const [role, style] of Object.entries(typeScale)) styled[role] = role === 'monoReference' ? style : { ...style, fontFamily };
    return styled as Record<TypeRole, TextStyle>;
  }, [fontFamily]);
}

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const layout = { margin: 20, listRowMin: 56, controlMin: 44, buttonMinHeight: 50 } as const;
