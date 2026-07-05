import axios from 'axios';
import { getAppNodeToken } from '@/utils/api';

// Separate Axios instance from utils/api.ts's apiClient: different base URL (the self-hosted
// WDK stack's app-node, not this project's own backend) and a different auth token (app-node's
// own short-lived HS256 JWT, minted per-call via getAppNodeToken() — see the backend's
// GET /wdk-app-node/token). No shared interceptor state; the token is attached per-request below.
export const appNodeClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_APP_NODE_URL ?? 'http://localhost:3000',
});

async function authHeaders(): Promise<{ Authorization: string }> {
  const token = await getAppNodeToken();
  return { Authorization: `Bearer ${token}` };
}

export type AppNodeWalletAddresses = Partial<Record<'ethereum' | 'bitcoin', string>>;

export type AppNodeWallet = {
  id: string;
  type: string;
  userId: string;
  addresses: AppNodeWalletAddresses;
};

// Idempotent — resolves (and lazily assigns, on first call) the data shard for the
// authenticated user. Safe to call every time, not just on first registration.
export async function connectAppNode(): Promise<void> {
  await appNodeClient.post('/api/v1/connect', {}, { headers: await authHeaders() });
}

export async function getAppNodeUserWallet(): Promise<AppNodeWallet | null> {
  const { data } = await appNodeClient.get<{ wallets: AppNodeWallet[] }>('/api/v1/wallets', {
    params: { type: 'user' },
    headers: await authHeaders(),
  });
  return data.wallets[0] ?? null;
}

export async function createAppNodeWallet(addresses: AppNodeWalletAddresses): Promise<AppNodeWallet> {
  const { data } = await appNodeClient.post<AppNodeWallet[]>(
    '/api/v1/wallets',
    [{ type: 'user', addresses, enabled: true }],
    { headers: await authHeaders() },
  );
  const wallet = data[0];
  if (!wallet) throw new Error('app-node did not return a created wallet');
  return wallet;
}

// Addresses are immutable once set on app-node — this only has an effect the first time a
// given network key is added to the wallet. Always pass the full known address set (not just
// the new ones), since PATCH's merge behavior with partial payloads isn't guaranteed.
export async function updateAppNodeWalletAddresses(
  walletId: string,
  addresses: AppNodeWalletAddresses,
): Promise<AppNodeWallet> {
  const { data } = await appNodeClient.patch<AppNodeWallet>(
    `/api/v1/wallets/${walletId}`,
    { addresses },
    { headers: await authHeaders() },
  );
  return data;
}

export type TokenTransfer = {
  transactionHash: string;
  blockchain: string;
  token: string;
  from: string;
  to: string;
  amount: string;
  ts: number;
  type: string;
};

export async function getUserTokenTransfers(
  userId: string,
  opts: { limit?: number; skip?: number } = {},
): Promise<TokenTransfer[]> {
  const { data } = await appNodeClient.get<{ transfers: TokenTransfer[] }>(
    `/api/v1/users/${encodeURIComponent(userId)}/token-transfers`,
    {
      params: { limit: opts.limit ?? 25, skip: opts.skip ?? 0, sort: 'desc' },
      headers: await authHeaders(),
    },
  );
  return data.transfers;
}
