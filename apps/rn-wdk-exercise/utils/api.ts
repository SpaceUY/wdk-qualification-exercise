import axios from 'axios';
import * as AuthSession from 'expo-auth-session';
import { useAuthStore } from '@/stores/authStore';

export const apiClient = axios.create({
  // 3001, not 3000 — the self-hosted WDK stack's app-node owns port 3000 locally (see
  // utils/appNodeApi.ts and EXPO_PUBLIC_APP_NODE_URL).
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001',
});

apiClient.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Must match hooks/useCognito.ts's discovery config — used here only to refresh an expired
// idToken via the Cognito refresh_token grant, not for the initial sign-in flow.
const COGNITO_DOMAIN = process.env.EXPO_PUBLIC_COGNITO_DOMAIN ?? '';
const COGNITO_CLIENT_ID = process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID ?? '';
const cognitoDiscovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: `${COGNITO_DOMAIN}/oauth2/authorize`,
  tokenEndpoint: `${COGNITO_DOMAIN}/oauth2/token`,
  revocationEndpoint: `${COGNITO_DOMAIN}/oauth2/revoke`,
};

// Coalesces concurrent 401s onto a single refresh call instead of firing one per request.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) return null;

  try {
    const result = await AuthSession.refreshAsync(
      { clientId: COGNITO_CLIENT_ID, refreshToken },
      cognitoDiscovery,
    );
    if (!result.idToken) return null;
    useAuthStore.getState().setAccessToken(result.idToken);
    useAuthStore.getState().setRefreshToken(result.refreshToken ?? refreshToken);
    return result.idToken;
  } catch {
    // Refresh token itself is invalid/expired — nothing left to do but sign the user out.
    useAuthStore.getState().clear();
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && originalRequest && !originalRequest._retriedAfterRefresh) {
      originalRequest._retriedAfterRefresh = true;
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newToken = await refreshPromise;
      if (newToken) {
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      }
    }

    return Promise.reject(error);
  },
);

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

// Short-lived JWT for the self-hosted WDK stack's app-node API — a different auth scheme
// (HS256, shared secret) than the Cognito token used everywhere else in this file.
export async function getAppNodeToken(): Promise<string> {
  const { data } = await apiClient.get<{ token: string }>('/wdk-app-node/token');
  return data.token;
}
