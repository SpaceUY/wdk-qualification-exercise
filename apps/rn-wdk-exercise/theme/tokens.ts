import type { TextStyle } from 'react-native';

// Layout scale — multiples of 4. Screens should size paddings/margins/gaps from
// here instead of hardcoding numbers, so density stays consistent across the app.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// Corner radii. `full` is a sentinel for circular/pill shapes.
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

// Type ramp consumed by AppText's `variant` prop. `mono` uses tabular numerals so
// amounts don't jitter horizontally while balances refresh.
export const typography = {
  display: { fontSize: 40, fontWeight: '700', letterSpacing: -0.8, lineHeight: 46 },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.3, lineHeight: 30 },
  subtitle: { fontSize: 17, fontWeight: '600', lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 21 },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  mono: { fontSize: 15, fontWeight: '500', lineHeight: 21, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
