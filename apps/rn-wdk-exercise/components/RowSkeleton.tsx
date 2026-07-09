import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';

// Pulsing placeholder row shared by every loading list (dashboard balances,
// history, cashback) so loading states look and feel the same across the app.
export function RowSkeleton({ testID = 'row-skeleton' }: { testID?: string }) {
  const styles = useThemedStyles(createStyles);
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <View testID={testID} style={styles.row}>
      <View>
        <Animated.View style={[styles.block, styles.title, { opacity }]} />
        <Animated.View style={[styles.block, styles.subtitle, { opacity }]} />
      </View>
      <Animated.View style={[styles.block, styles.trailing, { opacity }]} />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface,
      marginHorizontal: 16,
      marginVertical: 4,
      padding: 16,
      borderRadius: 10,
    },
    block: { backgroundColor: colors.border, borderRadius: 4 },
    title: { width: 60, height: 16, marginBottom: 6 },
    subtitle: { width: 80, height: 12 },
    trailing: { width: 70, height: 16 },
  });
