import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { spacing } from '@/theme/tokens';

export type DividerProps = {
  style?: StyleProp<ViewStyle>;
};

// Thin horizontal rule for separating sections inside a single consolidated Card
// (send/confirm/receive) — one primitive instead of repeating the same View style
// in three screens.
export function Divider({ style }: DividerProps) {
  const styles = useThemedStyles(createStyles);
  return <View style={[styles.divider, style]} />;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    divider: { height: 1, alignSelf: 'stretch', backgroundColor: colors.border, marginVertical: spacing.md },
  });
