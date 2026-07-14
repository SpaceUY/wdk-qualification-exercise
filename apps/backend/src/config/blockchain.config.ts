import { registerAs } from '@nestjs/config';

// `??` alone is not enough here: an empty value (`CASHBACK_BPS=` in a copied
// template) passes the nullish check and BigInt('') === 0n — silent 0% cashback.
function parseCashbackBps(): bigint {
  const raw = process.env['CASHBACK_BPS']?.trim();
  if (!raw) return 500n; // unset or blank → documented 5% default
  if (!/^\d+$/.test(raw)) {
    throw new Error(
      `CASHBACK_BPS must be a non-negative integer in basis points (e.g. 500 = 5%), got "${raw}"`,
    );
  }
  return BigInt(raw);
}

export const blockchainConfig = registerAs('blockchain', () => ({
  rpcUrl: process.env['ETHEREUM_RPC_URL'] ?? 'https://rpc.sepolia.org',
  chainId: 11155111,
  usdtAddress: process.env['USDT_CONTRACT_ADDRESS'] ?? '',
  utlAddress: process.env['UTL_CONTRACT_ADDRESS'] ?? '',
  treasuryPrivateKey: process.env['TREASURY_PRIVATE_KEY'] ?? '',
  merchantAddresses: (process.env['MERCHANT_ADDRESSES'] ?? '')
    .split(',')
    .map((a: string) => a.trim())
    .filter((a: string): a is string => a.length > 0)
    .map((a: string) => a.toLowerCase()),
  // Cashback rate in basis points; defaults to 500 (5%) if CASHBACK_BPS is unset.
  // Single source of truth — do not re-default this elsewhere.
  cashbackBps: parseCashbackBps(),
  // Anti-spam floor: payments below this (0.01 USDT, 6 decimals) never mint a coupon
  minPayoutUsdtRaw: 10_000n,
}));
