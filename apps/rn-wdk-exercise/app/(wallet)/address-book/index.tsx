import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { toast } from 'sonner-native';
import { Plus } from 'lucide-react-native';
import { useAddressBookStore } from '@/stores/addressBookStore';
import { useMerchants } from '@/hooks/useMerchants';
import { Header, HeaderBackTitle, HeaderIconButton } from '@/components/Header';
import { buildContactRows, buildMerchantRows, ContactRow } from '@/components/addressBook';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { spacing } from '@/theme/tokens';
import { AppText, FilterChips } from '@/components/ui';

type AddressBookTab = 'contacts' | 'merchants';

export default function AddressBookScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const contacts = useAddressBookStore((s) => s.contacts);
  const removeContact = useAddressBookStore((s) => s.removeContact);
  const [activeTab, setActiveTab] = useState<AddressBookTab>('contacts');
  const merchantsQuery = useMerchants();

  const rows = buildContactRows(contacts);

  function confirmDelete(id: string, name: string) {
    Alert.alert('Delete Contact', `Remove "${name}" from your address book?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeContact(id) },
    ]);
  }

  async function copyAddress(address: string) {
    await Clipboard.setStringAsync(address);
    toast.success('Copied', { description: 'Address copied to clipboard' });
  }

  function renderContacts() {
    if (rows.length === 0) {
      return (
        <View style={styles.empty}>
          <AppText variant="subtitle">No saved contacts yet</AppText>
          <AppText variant="caption" color="textMuted" style={styles.emptyHint}>
            Save frequent addresses with a name so you never paste them again.
          </AppText>
        </View>
      );
    }
    return (
      <FlatList
        testID="address-book-list"
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ContactRow
            contact={item}
            onPress={() => copyAddress(item.address)}
            onDelete={() => confirmDelete(item.id, item.name)}
          />
        )}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />
    );
  }

  // Read-only: merchants come live from the backend, never from the local store,
  // so there is no delete affordance and no Add button on this tab.
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
        testID="merchant-list"
        data={merchantRows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ContactRow contact={item} onPress={() => copyAddress(item.address)} />
        )}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Header
        left={<HeaderBackTitle title="Address Book" />}
        right={
          <HeaderIconButton
            testID="address-book-add-button"
            icon={Plus}
            accessibilityLabel="Add contact"
            onPress={() => router.push('/(wallet)/address-book/add')}
          />
        }
      />
      <FilterChips
        options={[
          { key: 'contacts', label: 'Contacts' },
          { key: 'merchants', label: 'Merchants' },
        ]}
        value={activeTab}
        onChange={setActiveTab}
        testIDPrefix="address-book-tab"
      />
      {activeTab === 'contacts' ? renderContacts() : renderMerchants()}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { flex: 1 },
  listContent: { paddingVertical: spacing.md },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyHint: { marginTop: spacing.sm, textAlign: 'center' },
});
