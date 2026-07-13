import { Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Trash2 } from 'lucide-react-native';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/components/ui';
import type { ContactRowData } from './buildContactRows';

const PRESS_SPRING = { damping: 18, stiffness: 260, mass: 0.6 };
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ContactRowProps = {
  contact: ContactRowData;
  onPress: () => void;
  // Present only on the management screen; the send picker omits it.
  onDelete?: () => void;
};

// One saved contact: initials avatar, name over truncated address, network chip on
// the right. Dumb component — receives cooked display strings, never a store object.
export function ContactRow({ contact, onPress, onDelete }: ContactRowProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[styles.row, animatedStyle]}
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.97, PRESS_SPRING); }}
      onPressOut={() => { scale.value = withSpring(1, PRESS_SPRING); }}
    >
      <View style={styles.avatar}>
        <AppText variant="subtitle" color="primary">{contact.initials}</AppText>
      </View>
      <View style={styles.identity}>
        <AppText variant="body" numberOfLines={1}>{contact.name}</AppText>
        <AppText variant="caption" color="textMuted">{contact.truncatedAddress}</AppText>
      </View>
      <View style={styles.networkChip}>
        <AppText variant="caption" color="textMuted" style={styles.networkChipText}>
          {contact.networkLabel}
        </AppText>
      </View>
      {onDelete != null && (
        <TouchableOpacity testID={`contact-delete-${contact.id}`} onPress={onDelete} hitSlop={8}>
          <Trash2 size={18} color={colors.danger} />
        </TouchableOpacity>
      )}
    </AnimatedPressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginHorizontal: spacing.lg,
      marginVertical: spacing.xs,
      padding: spacing.lg,
      borderRadius: radius.lg,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    identity: { flex: 1, gap: 2 },
    networkChip: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    networkChipText: { fontSize: 10, lineHeight: 14, fontWeight: '700' },
  });
