import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCheck, CircleHelp, Tag } from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { radius, spacing } from '@/theme/tokens';
import { AppText, Button } from '@/components/ui';
import { Header, HeaderBackTitle, HeaderIconButton } from '@/components/Header';
import { RowSkeleton } from '@/components/RowSkeleton';
import { useMerchants } from '@/hooks/useMerchants';

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
      <AppText variant="caption" color="textMuted">
        Merchant: {truncateMiddle(merchantAddress)}
      </AppText>
      <TouchableOpacity
        onPress={() => copyToClipboard('Merchant address', merchantAddress)}
        hitSlop={8}
      >
        <AppText variant="caption" color="primary" style={styles.copyLink}>Copy</AppText>
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

  const { data: merchants } = useMerchants();
  // null until the rate resolves — omit the percentage rather than promise a wrong one.
  const cashbackPct = merchants ? `${Math.round(merchants.cashbackRate * 100)}%` : null;

  function handleClaim(coupon: CouponListItem) {
    setPendingId(coupon.id);
    mutate(coupon.code, {
      onSuccess: () => {
        setPendingId(null);
        queryClient.invalidateQueries({ queryKey: ['coupons'] });
        // Success is a toast (non-blocking confirmation); errors stay as alerts
        // because they need the user's attention before retrying.
        toast.success('Coupon Redeemed!', {
          description: cashbackPct
            ? `${cashbackPct} cashback applied to your UTL balance.`
            : 'Cashback applied to your UTL balance.',
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
          <AppText color="danger" style={styles.errorText}>Failed to load coupons.</AppText>
          <Button title="Retry" onPress={() => refetchAvailable()} />
        </View>
      );
    }
    if (!available || available.length === 0) {
      return (
        <View style={styles.center}>
          <Tag size={40} color={colors.textSubtle} />
          <AppText color="textMuted" style={styles.emptyText}>No cashback coupons yet</AppText>
          <AppText variant="caption" color="textSubtle" style={styles.emptyHint}>
            Pay a merchant with USDT to earn UTL cashback.
          </AppText>
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
              <AppText style={styles.rowTitle}>
                {cashbackPct ? `${cashbackPct} cashback on ` : 'Cashback on '}
                ${formatUsdt(item.usdtAmountRaw)} USDT
              </AppText>
              <AppText variant="caption" color="textMuted" style={styles.rowSubtitle}>
                {formatUtl(item.utlAmountRaw)} UTL · {formatDate(item.createdAt)}
              </AppText>
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
                <AppText color="textOnPrimary" style={styles.claimButtonText}>Claim</AppText>
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
          <AppText color="danger" style={styles.errorText}>Failed to load claimed coupons.</AppText>
          <Button title="Retry" onPress={() => refetchClaimed()} />
        </View>
      );
    }
    if (!claimed || claimed.length === 0) {
      return (
        <View style={styles.center}>
          <CheckCheck size={40} color={colors.textSubtle} />
          <AppText color="textMuted" style={styles.emptyText}>No claimed coupons yet</AppText>
          <AppText variant="caption" color="textSubtle" style={styles.emptyHint}>
            Coupons you redeem will show up here.
          </AppText>
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
                <AppText style={styles.rowTitle}>
                  ${formatUsdt(item.usdtAmountRaw)} USDT → {formatUtl(item.utlAmountRaw)} UTL
                </AppText>
                <AppText variant="caption" color="textMuted" style={styles.rowSubtitle}>
                  ✓ Claimed {formatDate(item.redeemedAt)}
                </AppText>

                <MerchantAddressRow merchantAddress={item.merchantAddress} />

                <View style={styles.addressRow}>
                  <AppText variant="caption" color="textMuted">
                    {truncateMiddle(item.redemptionTxHash)}
                  </AppText>
                  <TouchableOpacity
                    onPress={() => copyToClipboard('Transaction hash', item.redemptionTxHash)}
                    hitSlop={8}
                  >
                    <AppText variant="caption" color="primary" style={styles.copyLink}>Copy</AppText>
                  </TouchableOpacity>
                  {explorerUrl ? (
                    <TouchableOpacity onPress={() => Linking.openURL(explorerUrl)} hitSlop={8}>
                      <AppText variant="caption" color="primary" style={styles.copyLink}>Explorer</AppText>
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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Header
        left={<HeaderBackTitle title="Cashback Coupons" />}
        right={
          <HeaderIconButton
            testID="cashback-help"
            icon={CircleHelp}
            accessibilityLabel="Coverage info"
            onPress={() =>
              toast.info('Coming soon', {
                description:
                  'Cashback currently works only for USDT on Ethereum (Sepolia) — other networks are coming soon.',
              })
            }
          />
        }
      />

      <View style={styles.tabBar}>
        <TouchableOpacity
          testID="cashback-tab-available"
          style={[styles.tab, activeTab === 'available' && styles.tabActive]}
          onPress={() => setActiveTab('available')}
        >
          <AppText
            color={activeTab === 'available' ? 'textPrimary' : 'textMuted'}
            style={styles.tabText}
          >
            Available
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          testID="cashback-tab-claimed"
          style={[styles.tab, activeTab === 'claimed' && styles.tabActive]}
          onPress={() => setActiveTab('claimed')}
        >
          <AppText
            color={activeTab === 'claimed' ? 'textPrimary' : 'textMuted'}
            style={styles.tabText}
          >
            Claimed
          </AppText>
        </TouchableOpacity>
      </View>

      {activeTab === 'available' ? renderAvailable() : renderClaimed()}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  skeletonList: { paddingVertical: spacing.xs },
  emptyText: { marginTop: spacing.md },
  emptyHint: { marginTop: spacing.xs, textAlign: 'center' },
  errorText: { marginBottom: spacing.lg, textAlign: 'center' },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: 10,
    // surfaceMuted, not border: the hairline border tokens are translucent and
    // read as invisible when used as a fill.
    backgroundColor: colors.surfaceMuted,
    padding: spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabActive: { backgroundColor: colors.surface },
  tabText: { fontWeight: '600' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  rowContent: { flex: 1, marginRight: spacing.md },
  claimedRowContent: { flex: 1 },
  rowTitle: { fontWeight: '600' },
  rowSubtitle: { marginTop: spacing.xs },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  copyLink: { fontWeight: '600' },
  claimButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    minWidth: 72,
    alignItems: 'center',
  },
  claimButtonText: { fontWeight: '600' },
});
