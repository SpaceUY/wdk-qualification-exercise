import { StyleSheet, View } from 'react-native';
import { useCognito } from '@/hooks/useCognito';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { spacing } from '@/theme/tokens';
import { AppText, Button } from '@/components/ui';

export default function LoginScreen() {
  const { promptAsync, ready } = useCognito();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <AppText variant="title" style={styles.title}>WDK Wallet</AppText>
      <AppText color="textMuted" style={styles.subtitle}>Sign in to access your wallet</AppText>

      <Button title="Sign in with Cognito" onPress={() => promptAsync()} loading={!ready} />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  title: { marginBottom: spacing.sm },
  subtitle: { marginBottom: 48 },
});
