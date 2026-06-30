import { registerAs } from '@nestjs/config';

export const blockchainConfig = registerAs('blockchain', () => ({
  rpcUrl: process.env['ETHEREUM_RPC_URL'] ?? 'https://rpc.sepolia.org',
  wssUrl: process.env['ETHEREUM_WSS_URL'] ?? '',
  chainId: 11155111,
  usdtAddress: process.env['USDT_CONTRACT_ADDRESS'] ?? '',
  utlAddress: process.env['UTL_CONTRACT_ADDRESS'] ?? '',
  treasuryPrivateKey: process.env['TREASURY_PRIVATE_KEY'] ?? '',
  merchantAddresses: (process.env['MERCHANT_ADDRESSES'] ?? '')
    .split(',')
    .map((a: string) => a.trim())
    .filter((a: string): a is string => a.length > 0)
    .map((a: string) => a.toLowerCase()),
  // 5% expressed as basis points
  cashbackBps: 500n,
  // Number of block confirmations required before processing a Transfer event
  confirmations: 2,
}));
