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
  // BIP-39 seed phrase for the treasury account — derived via WDK's EVM wallet module
  // (@tetherto/wdk-wallet-evm) instead of holding a raw private key directly.
  treasurySeedPhrase: process.env['TREASURY_SEED_PHRASE'] ?? '',
  // BIP-44 path appended after "m/44'/60'" (see WalletAccountEvm). "0'/0/0" is the
  // treasury's first derived account.
  treasuryDerivationPath: process.env['TREASURY_DERIVATION_PATH'] ?? "0'/0/0",
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
