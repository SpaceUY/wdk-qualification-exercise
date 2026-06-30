import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

export const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
});

apiClient.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

export async function postWalletBackup(ciphertext: string): Promise<void> {
  await apiClient.post('/wallets/backup', { ciphertext });
}

export async function putWalletAddress(walletAddress: string): Promise<void> {
  await apiClient.put('/wallets/address', { walletAddress });
}

export type CouponListItem = {
  id: string;
  code: string;
  usdtAmountRaw: string;
  utlAmountRaw: string;
  createdAt: string;
};

export async function getCoupons(): Promise<CouponListItem[]> {
  const { data } = await apiClient.get<CouponListItem[]>('/coupons');
  return data;
}

export type ClaimedCouponListItem = {
  id: string;
  usdtAmountRaw: string;
  utlAmountRaw: string;
  redeemedAt: string;
  redemptionTxHash: string;
  createdAt: string;
};

export async function getClaimedCoupons(): Promise<ClaimedCouponListItem[]> {
  const { data } = await apiClient.get<ClaimedCouponListItem[]>('/coupons/claimed');
  return data;
}
