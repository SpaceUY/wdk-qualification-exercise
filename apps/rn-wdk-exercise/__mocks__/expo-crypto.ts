import { randomBytes } from 'crypto';

export enum CryptoDigestAlgorithm {
  SHA256 = 'SHA256',
  SHA384 = 'SHA384',
  SHA512 = 'SHA512',
}

export async function getRandomBytesAsync(length: number): Promise<Uint8Array> {
  // Use Node's crypto.randomBytes for tests (more reliable than Expo's mock)
  return new Uint8Array(randomBytes(length));
}

export async function digestStringAsync(
  algorithm: CryptoDigestAlgorithm,
  data: string,
): Promise<string> {
  // Simplified mock - not cryptographically accurate but sufficient for tests
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return (hex.repeat(8)).substring(0, 64);
}
