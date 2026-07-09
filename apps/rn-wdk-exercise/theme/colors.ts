import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

// Semantic tokens — screens build their styles from a palette via useThemeColors(),
// never from raw hex values, so both themes stay complete by construction: adding a
// token here without a dark value is a compile error.
// `surface` and `textOnPrimary` share a value in light mode on purpose: same color
// today, different roles — they must be able to diverge independently (and do, in dark).
export const lightColors = {
  primary: '#2563eb',
  primarySoft: '#eff6ff',
  danger: '#ef4444',
  dangerStrong: '#dc2626',
  success: '#16a34a',
  successBg: '#dcfce7',
  successText: '#15803d',
  warningBg: '#fef3c7',
  warningBorder: '#f59e0b',
  warningText: '#b45309',
  background: '#f9fafb',
  surface: '#fff',
  surfaceMuted: '#f3f4f6',
  border: '#e5e7eb',
  borderStrong: '#d1d5db',
  textPrimary: '#111827',
  textMuted: '#6b7280',
  // Tertiary text (dates, placeholders). Deliberately darker than the old #aaa/#9ca3af:
  // those failed WCAG AA contrast (4.5:1) on white; this passes.
  textSubtle: '#71717a',
  textOnPrimary: '#fff',
  overlay: 'rgba(0, 0, 0, 0.4)',
} as const;

export type ThemeColors = { [K in keyof typeof lightColors]: string };

export const darkColors: ThemeColors = {
  primary: '#3b82f6',
  primarySoft: '#1e2f54',
  danger: '#f87171',
  dangerStrong: '#dc2626',
  success: '#4ade80',
  successBg: '#14532d',
  successText: '#86efac',
  warningBg: '#451a03',
  warningBorder: '#b45309',
  warningText: '#fbbf24',
  background: '#0f172a',
  surface: '#1e293b',
  surfaceMuted: '#334155',
  border: '#334155',
  borderStrong: '#475569',
  textPrimary: '#f1f5f9',
  textMuted: '#94a3b8',
  textSubtle: '#64748b',
  textOnPrimary: '#fff',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

// Resolves the active palette from the OS appearance setting (app.json sets
// userInterfaceStyle: "automatic"). Components re-render on scheme changes.
export function useThemeColors(): ThemeColors {
  return useColorScheme() === 'dark' ? darkColors : lightColors;
}

// Builds a component's StyleSheet from the active palette, memoized per theme.
// Usage: `const styles = useThemedStyles(createStyles)` with a module-level
// `const createStyles = (colors: ThemeColors) => StyleSheet.create({...})`.
export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  const colors = useThemeColors();
  return useMemo(() => factory(colors), [factory, colors]);
}
