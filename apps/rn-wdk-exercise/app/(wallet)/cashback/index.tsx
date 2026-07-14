import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCheck, CircleHelp, Tag } from 'lucide-react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { toast } from 'sonner-native';
import type { AxiosError } from 'axios';
import {
  apiClient,
  type CouponListItem,
  type ClaimedCouponListItem,
} from '@/utils/api';
import { formatFixedFromRaw } from '@/utils/balance';
import { getExplorerTxUrl } from '@/utils/explorer';
import { USDT_ETH_CONFIG, UTL_CONFIG } from '@/config/assets';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/components/ui';
import { Header, HeaderBackTitle, HeaderIconButton } from '@/components/Header';
import { useMerchants } from '@/hooks/useMerchants';
import { useCoupons, type CouponTab } from '@/hooks/useCoupons';
import { CouponList } from '@/components/CouponList';
import { SegmentedTabs } from '@/components/common/SegmentedTabs';

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
  const [activeTab, setActiveTab] = useState<CouponTab>('available');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { available, claimed } = useCoupons(activeTab);

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

      <SegmentedTabs
        tabs={[
          { key: 'available', label: 'Available', testID: 'cashback-tab-available' },
          { key: 'claimed', label: 'Claimed', testID: 'cashback-tab-claimed' },
        ]}
        activeKey={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'available' ? (
        <CouponList
          items={available.data}
          isLoading={available.isLoading}
          isError={available.isError}
          onRetry={() => available.refetch()}
          keyExtractor={(item) => item.id}
          emptyIcon={Tag}
          emptyTitle="No cashback coupons yet"
          emptyHint="Pay a merchant with USDT to earn UTL cashback."
          errorText="Failed to load coupons."
          renderItem={(item: CouponListItem) => (
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
                style={[styles.claimButton, pendingId != null && pendingId !== item.id && styles.claimButtonDisabled]}
                onPress={() => handleClaim(item)}
                disabled={pendingId != null}
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
      ) : (
        <CouponList
          items={claimed.data}
          isLoading={claimed.isLoading}
          isError={claimed.isError}
          onRetry={() => claimed.refetch()}
          keyExtractor={(item) => item.id}
          emptyIcon={CheckCheck}
          emptyTitle="No claimed coupons yet"
          emptyHint="Coupons you redeem will show up here."
          errorText="Failed to load claimed coupons."
          renderItem={(item: ClaimedCouponListItem) => {
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
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
  claimButtonDisabled: { opacity: 0.5 },
});
