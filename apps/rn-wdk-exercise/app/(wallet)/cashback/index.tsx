import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import {
  apiClient,
  getCoupons,
  getClaimedCoupons,
  type CouponListItem,
  type ClaimedCouponListItem,
} from '@/utils/api';

type Tab = 'available' | 'claimed';
type ClaimResponse = { redemptionTxHash: string };
type ClaimError = AxiosError<{ message?: string }>;

function useClaimCoupon() {
  return useMutation<ClaimResponse, ClaimError, string>({
    mutationFn: (code: string) =>
      apiClient.post<ClaimResponse>('/coupons/claim', { code }).then((r) => r.data),
  });
}

function formatUsdt(raw: string): string {
  return (Number(raw) / 1e6).toFixed(2);
}

function formatUtl(raw: string): string {
  return (Number(raw) / 1e18).toFixed(4);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function truncateTxHash(hash: string): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

export default function CashbackScreen() {
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

  function handleClaim(coupon: CouponListItem) {
    setPendingId(coupon.id);
    mutate(coupon.code, {
      onSuccess: () => {
        setPendingId(null);
        queryClient.invalidateQueries({ queryKey: ['coupons'] });
        Alert.alert('Coupon Redeemed!', '5% cashback applied to your UTL balance.');
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
        <View style={styles.center}>
          <ActivityIndicator size="large" />
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
          <Text style={styles.emptyText}>No cashback coupons yet</Text>
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
            <View>
              <Text style={styles.rowTitle}>
                5% cashback on ${formatUsdt(item.usdtAmountRaw)} USDT
              </Text>
              <Text style={styles.rowSubtitle}>
                {formatUtl(item.utlAmountRaw)} UTL · {formatDate(item.createdAt)}
              </Text>
            </View>
            <TouchableOpacity
              testID="claim-button"
              style={styles.claimButton}
              onPress={() => handleClaim(item)}
              disabled={pendingId === item.id}
            >
              {pendingId === item.id ? (
                <ActivityIndicator color="#fff" size="small" />
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
        <View style={styles.center}>
          <ActivityIndicator size="large" />
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
          <Text style={styles.emptyText}>No claimed coupons yet</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={claimed}
        keyExtractor={(item: ClaimedCouponListItem) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }: { item: ClaimedCouponListItem }) => (
          <View testID="cashback-claimed-item" style={styles.row}>
            <View style={styles.claimedRowContent}>
              <Text style={styles.rowTitle}>
                ${formatUsdt(item.usdtAmountRaw)} USDT → {formatUtl(item.utlAmountRaw)} UTL
              </Text>
              <Text style={styles.rowSubtitle}>
                ✓ Claimed {formatDate(item.redeemedAt)} · {truncateTxHash(item.redemptionTxHash)}
              </Text>
            </View>
          </View>
        )}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cashback Coupons</Text>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', padding: 24, paddingBottom: 12 },
  emptyText: { fontSize: 14, color: '#6b7280' },
  errorText: { color: '#ef4444', marginBottom: 16, textAlign: 'center' },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#111827' },
  list: { paddingHorizontal: 16, paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 8,
  },
  claimedRowContent: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  claimButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 72,
    alignItems: 'center',
  },
  claimButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
