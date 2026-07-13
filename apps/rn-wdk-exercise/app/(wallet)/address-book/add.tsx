import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { toast } from 'sonner-native';
import { useAddressBookStore } from '@/stores/addressBookStore';
import { CONTACT_NETWORK_OPTIONS, toContactNetworkValue } from '@/utils/addressBook';
import { Header, HeaderBackTitle } from '@/components/Header';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing, typography } from '@/theme/tokens';
import { AppText, Button, Card, FilterChips } from '@/components/ui';

export default function AddContactScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const addContact = useAddressBookStore((s) => s.addContact);
  // Set when opened from the send flow's picker (as /send/add-contact) so the chain
  // the user is sending on comes preselected; absent when opened from the address book.
  const params = useLocalSearchParams<{ network?: string }>();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState<string | null>(() => toContactNetworkValue(params.network));

  function handleSave() {
    if (!name.trim()) {
      toast.error('Name Required', { description: 'Give this contact a name or alias.' });
      return;
    }
    if (!address.trim()) {
      toast.error('Address Required', { description: 'Paste the address to save.' });
      return;
    }
    addContact({ name: name.trim(), address: address.trim(), network });
    toast.success('Contact Saved');
    router.back();
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Header left={<HeaderBackTitle title="Add Contact" />} />
      <ScrollView contentContainerStyle={styles.container}>
        <Card elevated>
          <AppText variant="caption" color="textMuted" style={styles.label}>Name</AppText>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Mom, Cold wallet"
            placeholderTextColor={colors.textSubtle}
          />

          <AppText variant="caption" color="textMuted" style={styles.label}>Address</AppText>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Paste the address"
            placeholderTextColor={colors.textSubtle}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <AppText variant="caption" color="textMuted" style={styles.label}>Network</AppText>
          <FilterChips
            options={CONTACT_NETWORK_OPTIONS.map((option) => ({
              // FilterChips keys must be strings; 'evm' stands in for the null
              // ("any EVM chain") network value and maps back on change.
              key: option.value ?? 'evm',
              label: option.label,
            }))}
            value={network ?? 'evm'}
            onChange={(key) => setNetwork(key === 'evm' ? null : key)}
            testIDPrefix="add-contact-network"
            style={styles.networkChips}
          />
          <AppText variant="caption" color="textSubtle" style={styles.networkHint}>
            EVM contacts work on Ethereum, Arbitrum and Polygon.
          </AppText>
        </Card>

        <Button title="Save Contact" onPress={handleSave} style={styles.saveButton} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.xl },
  label: { fontWeight: '600', marginBottom: spacing.sm, marginTop: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: typography.body.fontSize,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
  },
  // Reset the chips' built-in screen margins — inside the Card the Card's own
  // padding provides them — and let the four options wrap on narrow screens.
  networkChips: { marginHorizontal: 0, marginTop: 0, flexWrap: 'wrap' },
  networkHint: { marginTop: spacing.sm },
  saveButton: { marginTop: spacing.lg },
});
