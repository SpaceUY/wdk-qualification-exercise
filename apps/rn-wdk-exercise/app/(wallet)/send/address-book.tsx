import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useAddressBookStore } from '@/stores/addressBookStore';
import { contactMatchesNetwork, isEvmNetwork } from '@/utils/addressBook';
import { useMerchants } from '@/hooks/useMerchants';
import { Header, HeaderBackTitle, HeaderIconButton } from '@/components/Header';
import { buildContactRows, buildMerchantRows, ContactRow } from '@/components/addressBook';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { spacing } from '@/theme/tokens';
import { AppText, Button, FilterChips } from '@/components/ui';

type PickerTab = 'contacts' | 'merchants';

// Contact picker for the send flow. Returns the selection through the same
// `scannedAddress` param the QR scanner uses, so SendScreen treats both sources
// identically and needed no changes to receive it.
export default function SendAddressBookScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const params = useLocalSearchParams<{ network?: string }>();
  const contacts = useAddressBookStore((s) => s.contacts);
  const [activeTab, setActiveTab] = useState<PickerTab>('contacts');
  const merchantsQuery = useMerchants();

  // Only contacts that are valid on the network being sent on — a Bitcoin contact
  // is never offered while sending USDT on Tron.
  const network = params.network ?? '';
  const rows = buildContactRows(contacts.filter((c) => contactMatchesNetwork(c.network, network)));

  // Backend merchants are EVM-only (no per-chain field), so the tab is hidden
  // entirely when sending on bitcoin/tron/spark — same null-network semantics as
  // EVM-only contacts. '' means no network preselected yet.
  const showMerchantsTab = network === '' || isEvmNetwork(network);
  const currentTab: PickerTab = showMerchantsTab ? activeTab : 'contacts';

  function handleSelect(address: string) {
    // NOT router.navigate: since SDK 52 navigate pushes a NEW send/index instance
    // (presented as another modal on top of this sheet) instead of returning to the
    // existing one. dismissTo pops the stack back to send/index, closing this sheet
    // and delivering the params in one native transition.
    router.dismissTo({
      pathname: '/(wallet)/send',
      params: { scannedAddress: address },
    });
  }

  // Stacked modal within the send stack: this picker stays mounted underneath, so
  // after saving the user lands right back here with the new contact already in the
  // filtered list. The active network travels along so the form preselects a chain
  // the new contact will actually be visible on.
  function handleAddContact() {
    router.push({ pathname: '/(wallet)/send/add-contact', params: { network } });
  }

  // Management is an exit from the send flow and its route lives on the parent
  // (wallet) stack — pushing it directly would land BEHIND this native sheet and
  // appear to do nothing, so pop the sheet first, then navigate.
  function handleManageContacts() {
    router.back();
    router.push('/(wallet)/address-book');
  }

  function renderContacts() {
    if (rows.length === 0) {
      return (
        <View style={styles.empty}>
          <AppText variant="subtitle">No contacts for this network</AppText>
          <AppText variant="caption" color="textMuted" style={styles.emptyHint}>
            Contacts are filtered to addresses that work on the selected token&apos;s network.
          </AppText>
          <Button title="Add Contact" onPress={handleAddContact} style={styles.emptyButton} />
        </View>
      );
    }
    return (
      <FlatList
        testID="send-contact-list"
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ContactRow contact={item} onPress={() => handleSelect(item.address)} />
        )}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />
    );
  }

  // Picking a merchant feeds the send flow through the exact same param as a
  // contact — confirm.tsx re-detects the address as a merchant on its own and
  // shows the cashback badge without any extra plumbing.
  function renderMerchants() {
    if (merchantsQuery.isPending) {
      return (
        <View style={styles.empty}>
          <ActivityIndicator size="large" />
        </View>
      );
    }
    if (merchantsQuery.isError) {
      return (
        <View style={styles.empty}>
          <AppText variant="subtitle">Couldn&apos;t load merchants</AppText>
          <AppText variant="caption" color="textMuted" style={styles.emptyHint}>
            Check your connection and try again.
          </AppText>
        </View>
      );
    }
    const merchantRows = buildMerchantRows(merchantsQuery.data);
    if (merchantRows.length === 0) {
      return (
        <View style={styles.empty}>
          <AppText variant="subtitle">No merchants available</AppText>
        </View>
      );
    }
    return (
      <FlatList
        testID="send-merchant-list"
        data={merchantRows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ContactRow contact={item} onPress={() => handleSelect(item.address)} />
        )}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Header
        left={<HeaderBackTitle title="Choose Contact" />}
        right={
          <HeaderIconButton
            testID="send-contact-add-button"
            icon={Plus}
            accessibilityLabel="Add contact"
            onPress={handleAddContact}
          />
        }
      />
      {showMerchantsTab && (
        <FilterChips
          options={[
            { key: 'contacts', label: 'Contacts' },
            { key: 'merchants', label: 'Merchants' },
          ]}
          value={currentTab}
          onChange={setActiveTab}
          testIDPrefix="send-contact-tab"
        />
      )}
      {currentTab === 'contacts' ? renderContacts() : renderMerchants()}
      <View style={styles.footer}>
        <Button title="Manage Contacts" variant="ghost" onPress={handleManageContacts} />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { flex: 1 },
  listContent: { paddingVertical: spacing.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyHint: { marginTop: spacing.sm, textAlign: 'center' },
  emptyButton: { marginTop: spacing.lg, alignSelf: 'stretch' },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
});
