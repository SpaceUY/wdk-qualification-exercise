import { useMemo } from 'react';

// Semantic tokens — screens build their styles from the palette via useThemeColors(),
// never from raw hex values.
// The app is dark-only by design (app.json sets userInterfaceStyle: "dark"). The
// palette derives from the Northstar logo: navy #28323E sets the hue of the whole
// background/elevation scale, and the shield golds #D0A64E / #F5D381 are the only
// saturated accent — rationed to CTAs, active states, and brand moments so they
// keep reading as premium instead of noise.
export const colors = {
  // Accent — midpoint of the logo's two golds. Buttons, links, active icons.
  primary: '#E8C270',
  // Gold at ~10% over navy: tonal backgrounds (badges, active tab pill).
  primarySoft: '#2E2A1F',

  // Status colors, desaturated to sit next to the gold without competing.
  danger: '#F07A6E',
  dangerStrong: '#D9534F',
  success: '#5FBF8F',
  successBg: '#16291F',
  successText: '#8FD9B2',
  // Warnings reuse the logo golds literally, so wallet warnings stay on-brand.
  warningBg: '#2E2413',
  warningBorder: '#D0A64E',
  warningText: '#F5D381',

  // Elevation scale — 4 steps sharing the logo navy's hue. The logo color itself
  // (#28323E) is the TOP of the scale (surfaceElevated), not the background: cards
  // need somewhere to rise to, and the logo floats naturally on hero surfaces.
  background: '#0C1117',
  surface: '#151C24',
  surfaceMuted: '#1D2632',
  surfaceElevated: '#28323E',

  // Hairline translucent borders — this is what gives the "glass" edge on dark.
  // Fills must NOT use these (too faint as a background); use surfaceMuted instead.
  border: 'rgba(255, 255, 255, 0.07)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',

  // Text — cool grays with the same blue tint as the backgrounds.
  textPrimary: '#F2F4F7',
  textMuted: '#98A2B3',
  textSubtle: '#667085',
  // DARK text on the gold primary button (white on gold fails WCAG AA); mirrors
  // the logo's own figure/ground: navy star on gold shield.
  textOnPrimary: '#221C0E',

  // Gold desaturated: disabled accents, secondary ticks.
  accentMuted: '#8A7440',

  overlay: 'rgba(5, 8, 12, 0.65)',
} as const;

export type ThemeColors = { [K in keyof typeof colors]: string };

// Dark-only: always returns the single palette. Kept as a hook so the existing
// call sites don't change and a second theme could be reintroduced later without
// touching every screen.
export function useThemeColors(): ThemeColors {
  return colors;
}

// Builds a component's StyleSheet from the palette, memoized.
// Usage: `const styles = useThemedStyles(createStyles)` with a module-level
// `const createStyles = (colors: ThemeColors) => StyleSheet.create({...})`.
export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  return useMemo(() => factory(colors), [factory]);
}
