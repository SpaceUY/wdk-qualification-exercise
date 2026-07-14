import { FlatList, StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { spacing } from '@/theme/tokens';
import { AppText, Button } from '@/components/ui';
import { RowSkeleton } from '@/components/RowSkeleton';

export type CouponListProps<T> = {
  items: T[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => React.ReactElement;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyHint: string;
  errorText: string;
  skeletonCount?: number;
};

export function CouponList<T>({
  items, isLoading, isError, onRetry, keyExtractor, renderItem,
  emptyIcon: EmptyIcon, emptyTitle, emptyHint, errorText, skeletonCount = 4,
}: CouponListProps<T>) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  if (isLoading) {
    return (
      <View style={styles.skeletonList} testID="cashback-skeleton">
        {Array.from({ length: skeletonCount }, (_, i) => <RowSkeleton key={i} />)}
      </View>
    );
  }
  if (isError) {
    return (
      <View style={styles.center}>
        <AppText color="danger" style={styles.errorText}>{errorText}</AppText>
        <Button title="Retry" onPress={onRetry} />
      </View>
    );
  }
  if (!items || items.length === 0) {
    return (
      <View style={styles.center}>
        <EmptyIcon size={40} color={colors.textSubtle} />
        <AppText color="textMuted" style={styles.emptyText}>{emptyTitle}</AppText>
        <AppText variant="caption" color="textSubtle" style={styles.emptyHint}>{emptyHint}</AppText>
      </View>
    );
  }
  return (
    <FlatList
      data={items}
      keyExtractor={keyExtractor}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => renderItem(item)}
    />
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  skeletonList: { paddingVertical: spacing.xs },
  emptyText: { marginTop: spacing.md },
  emptyHint: { marginTop: spacing.xs, textAlign: 'center' },
  errorText: { marginBottom: spacing.lg, textAlign: 'center' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});
