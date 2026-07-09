import * as Crypto from 'expo-crypto';
import { gcm } from '@noble/ciphers/aes';
import { scryptAsync } from '@noble/hashes/scrypt';
import { utf8ToBytes, bytesToUtf8 } from '@noble/hashes/utils';

export const MIN_PASSPHRASE_LENGTH = 8;

const COMMON_WEAK_PASSPHRASES = new Set([
  'password', 'password1', 'password123', '12345678', '123456789',
  'qwertyui', 'qwerty123', '11111111', '00000000', 'letmein1',
  'iloveyou', 'abc123456',
]);

export function validatePassphraseStrength(passphrase: string): string | null {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`;
  }
  if (new Set(passphrase.toLowerCase()).size < 4) {
    return 'Passphrase is too repetitive — use a mix of different characters.';
  }
  if (COMMON_WEAK_PASSPHRASES.has(passphrase.toLowerCase())) {
    return 'This passphrase is too common — choose something more unique.';
  }
  return null;
}

const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const HEADER_LENGTH = 1 + SALT_LENGTH + IV_LENGTH;
const MIN_BLOB_LENGTH = HEADER_LENGTH + 16; // + 16-byte GCM tag

type ScryptParams = { N: number; r: number; p: number; dkLen: number };

// Every version this app has ever written must stay here forever so old backups
// remain decryptable. Only ADD entries below — never remove or mutate an existing one.
const SCRYPT_PARAMS_BY_VERSION: Record<number, ScryptParams> = {
  0x01: { N: 16384, r: 8, p: 1, dkLen: KEY_LENGTH }, // legacy — below OWASP's minimum, kept only for decrypting old backups
  0x02: { N: 131072, r: 8, p: 1, dkLen: KEY_LENGTH }, // OWASP Password Storage Cheat Sheet minimum (2^17) — too slow as a pure-JS mobile KDF, kept only for decrypting old backups
  0x03: { N: 32768, r: 8, p: 1, dkLen: KEY_LENGTH }, // current — OWASP's reduced-resource tier (2^15), ~4x faster/lighter than 2^17 on-device
};

const CURRENT_VERSION = 0x03;

export class IncorrectPassphraseError extends Error {
  constructor() {
    super('Incorrect passphrase or corrupted backup');
    this.name = 'IncorrectPassphraseError';
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  version: number,
  onProgress?: (fraction: number) => void,
): Promise<Uint8Array> {
  const params = SCRYPT_PARAMS_BY_VERSION[version];
  return scryptAsync(utf8ToBytes(passphrase), salt, { ...params, onProgress });
}

export async function encryptMnemonic(
  mnemonic: string,
  passphrase: string,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const salt = await Crypto.getRandomBytesAsync(SALT_LENGTH);
  const iv = await Crypto.getRandomBytesAsync(IV_LENGTH);
  const key = await deriveKey(passphrase, salt, CURRENT_VERSION, onProgress);
  const ciphertext = gcm(key, iv).encrypt(utf8ToBytes(mnemonic));

  const blob = new Uint8Array(HEADER_LENGTH + ciphertext.length);
  blob[0] = CURRENT_VERSION;
  blob.set(salt, 1);
  blob.set(iv, 1 + SALT_LENGTH);
  blob.set(ciphertext, HEADER_LENGTH);

  return bytesToBase64(blob);
}

export async function decryptMnemonic(
  ciphertextBase64: string,
  passphrase: string,
): Promise<string> {
  const blob = base64ToBytes(ciphertextBase64);

  if (blob.length < MIN_BLOB_LENGTH || !(blob[0] in SCRYPT_PARAMS_BY_VERSION)) {
    throw new IncorrectPassphraseError();
  }

  const version = blob[0];
  const salt = blob.slice(1, 1 + SALT_LENGTH);
  const iv = blob.slice(1 + SALT_LENGTH, HEADER_LENGTH);
  const ciphertext = blob.slice(HEADER_LENGTH);

  const key = await deriveKey(passphrase, salt, version);

  try {
    const plaintext = gcm(key, iv).decrypt(ciphertext);
    return bytesToUtf8(plaintext);
  } catch {
    throw new IncorrectPassphraseError();
  }
}
