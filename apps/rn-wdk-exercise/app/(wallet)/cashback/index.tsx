import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@tetherto/wdk-react-native-core';
import * as Clipboard from 'expo-clipboard';
import { toast } from 'sonner-native';
import type { AxiosError } from 'axios';
import {
  apiClient,
  getCoupons,
  getClaimedCoupons,
  type CouponListItem,
  type ClaimedCouponListItem,
} from '@/utils/api';
import { formatFixedFromRaw } from '@/utils/balance';
import { getExplorerTxUrl } from '@/utils/explorer';
import { USDT_ETH_CONFIG, UTL_CONFIG } from '@/config/assets';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { ScreenHeader } from '@/components/ScreenHeader';
import { RowSkeleton } from '@/components/RowSkeleton';

type Tab = 'available' | 'claimed';
type ClaimResponse = { redemptionTxHash: string };
type ClaimError = AxiosError<{ message?: string }>;

function useClaimCoupon() {
  return useMutation<ClaimResponse, ClaimError, string>({
    mutationFn: (code: string) =>
      apiClient.post<ClaimResponse>('/coupons/claim', { code }).then((r) => r.data),
  });
}

// Decimals come from the asset configs — the same source of truth the wallet uses —
// so a token config change can never silently diverge from this screen's formatting.
function formatUsdt(raw: string): string {
  return formatFixedFromRaw(raw, USDT_ETH_CONFIG.decimals, 2);
}

function formatUtl(raw: string): string {
  return formatFixedFromRaw(raw, UTL_CONFIG.decimals, 4);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function truncateMiddle(value: string): string {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

async function copyToClipboard(label: string, value: string) {
  await Clipboard.setStringAsync(value);
  toast.success('Copied', { description: `${label} copied to clipboard.` });
}

// Coupons created before merchantAddress existed in the schema arrive without it —
// rendering nothing beats crashing on `undefined.slice` (the raw address adds little
// for a legacy coupon anyway).
function MerchantAddressRow({ merchantAddress }: { merchantAddress?: string | null }) {
  const styles = useThemedStyles(createStyles);
  if (!merchantAddress) return null;
  return (
    <View style={styles.addressRow}>
      <Text style={styles.addressText}>Merchant: {truncateMiddle(merchantAddress)}</Text>
      <TouchableOpacity
        onPress={() => copyToClipboard('Merchant address', merchantAddress)}
        hitSlop={8}
      >
        <Text style={styles.copyLink}>Copy</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CashbackScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('available');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { addresses } = useWallet({ autoLoadAccountIndices: [0] });
  const myAddress = addresses['ethereum']?.[0] ?? null;

  const {
    data: available,
    isLoading: availableLoading,
    isError: availableError,
    refetch: refetchAvailable,
  } = useQuery({
    queryKey: ['coupons'],
    queryFn: getCoupons,
    enabled: activeTab === 'available',
  });

  const {
    data: claimed,
    isLoading: claimedLoading,
    isError: claimedError,
    refetch: refetchClaimed,
  } = useQuery({
    queryKey: ['coupons', 'claimed'],
    queryFn: getClaimedCoupons,
    enabled: activeTab === 'claimed',
  });

  const { mutate } = useClaimCoupon();

  function handleClaim(coupon: CouponListItem) {
    setPendingId(coupon.id);
    mutate(coupon.code, {
      onSuccess: () => {
        setPendingId(null);
        queryClient.invalidateQueries({ queryKey: ['coupons'] });
        // Success is a toast (non-blocking confirmation); errors stay as alerts
        // because they need the user's attention before retrying.
        toast.success('Coupon Redeemed!', {
          description: '5% cashback applied to your UTL balance.',
        });
      },
      onError: (err) => {
        setPendingId(null);
        Alert.alert(
          'Claim Failed',
          err.response?.data?.message ?? 'Invalid or already used coupon code.',
        );
      },
    });
  }

  function renderAvailable() {
    if (availableLoading) {
      return (
        <View style={styles.skeletonList} testID="cashback-skeleton">
          {Array.from({ length: 4 }, (_, i) => (
            <RowSkeleton key={i} />
          ))}
        </View>
      );
    }
    if (availableError) {
      return (
        <View style={styles.center}>
          <Text style={styles.errorText}>Failed to load coupons.</Text>
          <TouchableOpacity style={styles.button} onPress={() => refetchAvailable()}>
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (!available || available.length === 0) {
      return (
        <View style={styles.center}>
          <Ionicons name="pricetag-outline" size={40} color={colors.textSubtle} />
          <Text style={styles.emptyText}>No cashback coupons yet</Text>
          <Text style={styles.emptyHint}>Pay a merchant with USDT to earn UTL cashback.</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={available}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View testID="cashback-item" style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>
                5% cashback on ${formatUsdt(item.usdtAmountRaw)} USDT
              </Text>
              <Text style={styles.rowSubtitle}>
                {formatUtl(item.utlAmountRaw)} UTL · {formatDate(item.createdAt)}
              </Text>
              <MerchantAddressRow merchantAddress={item.merchantAddress} />
            </View>
            <TouchableOpacity
              testID="claim-button"
              style={styles.claimButton}
              onPress={() => handleClaim(item)}
              disabled={pendingId === item.id}
            >
              {pendingId === item.id ? (
                <ActivityIndicator color={colors.textOnPrimary} size="small" />
              ) : (
                <Text style={styles.claimButtonText}>Claim</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      />
    );
  }

  function renderClaimed() {
    if (claimedLoading) {
      return (
        <View style={styles.skeletonList} testID="cashback-skeleton">
          {Array.from({ length: 4 }, (_, i) => (
            <RowSkeleton key={i} />
          ))}
        </View>
      );
    }
    if (claimedError) {
      return (
        <View style={styles.center}>
          <Text style={styles.errorText}>Failed to load claimed coupons.</Text>
          <TouchableOpacity style={styles.button} onPress={() => refetchClaimed()}>
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (!claimed || claimed.length === 0) {
      return (
        <View style={styles.center}>
          <Ionicons name="checkmark-done-outline" size={40} color={colors.textSubtle} />
          <Text style={styles.emptyText}>No claimed coupons yet</Text>
          <Text style={styles.emptyHint}>Coupons you redeem will show up here.</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={claimed}
        keyExtractor={(item: ClaimedCouponListItem) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }: { item: ClaimedCouponListItem }) => {
          const explorerUrl = getExplorerTxUrl('ethereum', item.redemptionTxHash);
          return (
            <View testID="cashback-claimed-item" style={styles.row}>
              <View style={styles.claimedRowContent}>
                <Text style={styles.rowTitle}>
                  ${formatUsdt(item.usdtAmountRaw)} USDT → {formatUtl(item.utlAmountRaw)} UTL
                </Text>
                <Text style={styles.rowSubtitle}>✓ Claimed {formatDate(item.redeemedAt)}</Text>

                <MerchantAddressRow merchantAddress={item.merchantAddress} />

                <View style={styles.addressRow}>
                  <Text style={styles.addressText}>
                    {truncateMiddle(item.redemptionTxHash)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => copyToClipboard('Transaction hash', item.redemptionTxHash)}
                    hitSlop={8}
                  >
                    <Text style={styles.copyLink}>Copy</Text>
                  </TouchableOpacity>
                  {explorerUrl ? (
                    <TouchableOpacity onPress={() => Linking.openURL(explorerUrl)} hitSlop={8}>
                      <Text style={styles.copyLink}>Explorer</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
          );
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Cashback Coupons" />

      {myAddress ? (
        <View style={styles.myAddressBanner}>
          <Text style={styles.myAddressLabel}>Cashback goes to</Text>
          <View style={styles.addressRow}>
            <Text style={styles.myAddressText} numberOfLines={1}>
              {myAddress}
            </Text>
            <TouchableOpacity
              onPress={() => copyToClipboard('Your address', myAddress)}
              hitSlop={8}
            >
              <Text style={styles.copyLink}>Copy</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={styles.tabBar}>
        <TouchableOpacity
          testID="cashback-tab-available"
          style={[styles.tab, activeTab === 'available' && styles.tabActive]}
          onPress={() => setActiveTab('available')}
        >
          <Text style={[styles.tabText, activeTab === 'available' && styles.tabTextActive]}>
            Available
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="cashback-tab-claimed"
          style={[styles.tab, activeTab === 'claimed' && styles.tabActive]}
          onPress={() => setActiveTab('claimed')}
        >
          <Text style={[styles.tabText, activeTab === 'claimed' && styles.tabTextActive]}>
            Claimed
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'available' ? renderAvailable() : renderClaimed()}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  skeletonList: { paddingVertical: 4 },
  emptyText: { fontSize: 14, color: colors.textMuted, marginTop: 12 },
  emptyHint: { fontSize: 12, color: colors.textSubtle, marginTop: 4, textAlign: 'center' },
  errorText: { color: colors.danger, marginBottom: 16, textAlign: 'center' },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: colors.border,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: { backgroundColor: colors.surface },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.textPrimary },
  list: { paddingHorizontal: 16, paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 16,
    marginBottom: 8,
  },
  rowContent: { flex: 1, marginRight: 12 },
  claimedRowContent: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  rowSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  addressText: { fontSize: 12, color: colors.textMuted },
  copyLink: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  myAddressBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
  },
  myAddressLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  myAddressText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  claimButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 72,
    alignItems: 'center',
  },
  claimButtonText: { color: colors.textOnPrimary, fontSize: 14, fontWeight: '600' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '600' },
});
