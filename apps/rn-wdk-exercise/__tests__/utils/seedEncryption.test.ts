import {
  encryptMnemonic,
  decryptMnemonic,
  IncorrectPassphraseError,
  KeyDerivationError,
  MIN_PASSPHRASE_LENGTH,
  validatePassphraseStrength,
} from '../../utils/seedEncryption';
import { gcm } from '@noble/ciphers/aes';
import { scryptAsync } from '@noble/hashes/scrypt';
import { utf8ToBytes } from '@noble/hashes/utils';
import * as Crypto from 'expo-crypto';
import QuickCrypto from 'react-native-quick-crypto';

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PASSPHRASE = 'correct-horse-battery-staple';

describe('seedEncryption', () => {
  it('round-trips: decrypting with the same passphrase returns the original mnemonic', async () => {
    const ciphertext = await encryptMnemonic(MNEMONIC, PASSPHRASE);
    const decrypted = await decryptMnemonic(ciphertext, PASSPHRASE);
    expect(decrypted).toBe(MNEMONIC);
  });

  it('produces a different ciphertext each time (random salt/IV)', async () => {
    const first = await encryptMnemonic(MNEMONIC, PASSPHRASE);
    const second = await encryptMnemonic(MNEMONIC, PASSPHRASE);
    expect(first).not.toBe(second);
  });

  it('throws IncorrectPassphraseError when the passphrase is wrong', async () => {
    const ciphertext = await encryptMnemonic(MNEMONIC, PASSPHRASE);
    await expect(decryptMnemonic(ciphertext, 'wrong-passphrase')).rejects.toThrow(
      IncorrectPassphraseError,
    );
  });

  it('throws IncorrectPassphraseError when the ciphertext has been tampered with', async () => {
    const ciphertext = await encryptMnemonic(MNEMONIC, PASSPHRASE);
    const bytes = Buffer.from(ciphertext, 'base64');
    bytes[bytes.length - 1] ^= 0xff; // flip the last byte (inside the GCM tag)
    const tampered = bytes.toString('base64');

    await expect(decryptMnemonic(tampered, PASSPHRASE)).rejects.toThrow(IncorrectPassphraseError);
  });

  it('throws IncorrectPassphraseError on a too-short blob', async () => {
    await expect(decryptMnemonic('YWJj', PASSPHRASE)).rejects.toThrow(IncorrectPassphraseError);
  });

  it('throws IncorrectPassphraseError on a wrong version byte', async () => {
    const ciphertext = await encryptMnemonic(MNEMONIC, PASSPHRASE);
    const bytes = Buffer.from(ciphertext, 'base64');
    bytes[0] = 0x99;
    const wrongVersion = bytes.toString('base64');

    await expect(decryptMnemonic(wrongVersion, PASSPHRASE)).rejects.toThrow(
      IncorrectPassphraseError,
    );
  });

  it('decrypts a legacy version-0x01 blob using the old (weaker) scrypt params', async () => {
    // Hand-construct a v1 blob exactly as the original (pre-hardening) encryptMnemonic did,
    // using the OLD scrypt params (N: 16384) directly — this proves the new decryptMnemonic
    // still knows how to read backups made before this change, without needing production
    // code to expose a way to deliberately encrypt an old version.
    const salt = await Crypto.getRandomBytesAsync(16);
    const iv = await Crypto.getRandomBytesAsync(12);
    const legacyKey = await scryptAsync(utf8ToBytes(PASSPHRASE), salt, {
      N: 16384,
      r: 8,
      p: 1,
      dkLen: 32,
    });
    const ciphertext = gcm(legacyKey, iv).encrypt(utf8ToBytes(MNEMONIC));

    const blob = new Uint8Array(1 + 16 + 12 + ciphertext.length);
    blob[0] = 0x01;
    blob.set(salt, 1);
    blob.set(iv, 17);
    blob.set(ciphertext, 29);

    let binary = '';
    for (let i = 0; i < blob.length; i++) binary += String.fromCharCode(blob[i]);
    const legacyBlobBase64 = btoa(binary);

    const decrypted = await decryptMnemonic(legacyBlobBase64, PASSPHRASE);
    expect(decrypted).toBe(MNEMONIC);
  });

  it('encryptMnemonic always writes the current version byte (0x04)', async () => {
    const ciphertext = await encryptMnemonic(MNEMONIC, PASSPHRASE);
    const bytes = Buffer.from(ciphertext, 'base64');
    expect(bytes[0]).toBe(0x04);
  });

  it('decrypts a version-0x02 blob using the previous (heavier) scrypt params', async () => {
    const salt = await Crypto.getRandomBytesAsync(16);
    const iv = await Crypto.getRandomBytesAsync(12);
    const v2Key = await scryptAsync(utf8ToBytes(PASSPHRASE), salt, {
      N: 131072,
      r: 8,
      p: 1,
      dkLen: 32,
    });
    const ciphertext = gcm(v2Key, iv).encrypt(utf8ToBytes(MNEMONIC));

    const blob = new Uint8Array(1 + 16 + 12 + ciphertext.length);
    blob[0] = 0x02;
    blob.set(salt, 1);
    blob.set(iv, 17);
    blob.set(ciphertext, 29);

    let binary = '';
    for (let i = 0; i < blob.length; i++) binary += String.fromCharCode(blob[i]);
    const v2BlobBase64 = btoa(binary);

    const decrypted = await decryptMnemonic(v2BlobBase64, PASSPHRASE);
    expect(decrypted).toBe(MNEMONIC);
  });

  it('decrypts a version-0x03 blob using the reduced-resource scrypt params', async () => {
    const salt = await Crypto.getRandomBytesAsync(16);
    const iv = await Crypto.getRandomBytesAsync(12);
    const v3Key = await scryptAsync(utf8ToBytes(PASSPHRASE), salt, {
      N: 32768,
      r: 8,
      p: 1,
      dkLen: 32,
    });
    const ciphertext = gcm(v3Key, iv).encrypt(utf8ToBytes(MNEMONIC));

    const blob = new Uint8Array(1 + 16 + 12 + ciphertext.length);
    blob[0] = 0x03;
    blob.set(salt, 1);
    blob.set(iv, 17);
    blob.set(ciphertext, 29);

    let binary = '';
    for (let i = 0; i < blob.length; i++) binary += String.fromCharCode(blob[i]);
    const v3BlobBase64 = btoa(binary);

    const decrypted = await decryptMnemonic(v3BlobBase64, PASSPHRASE);
    expect(decrypted).toBe(MNEMONIC);
  });

  it('wraps scrypt engine failures in KeyDerivationError with a user-safe message', async () => {
    const spy = jest.spyOn(QuickCrypto, 'scrypt').mockImplementation(((...args: unknown[]) => {
      const callback = args[args.length - 1] as (err: Error | null) => void;
      callback(new Error("Couldn't create HybridObject 'Scrypt'"));
    }) as unknown as typeof QuickCrypto.scrypt);

    try {
      const attempt = encryptMnemonic(MNEMONIC, PASSPHRASE);
      await expect(attempt).rejects.toThrow(KeyDerivationError);
      await expect(attempt).rejects.toThrow(
        'Could not prepare encryption on this device. Please update the app and try again.',
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('exports a minimum passphrase length of 8', () => {
    expect(MIN_PASSPHRASE_LENGTH).toBe(8);
  });
});

describe('validatePassphraseStrength', () => {
  it('returns null for a strong passphrase', () => {
    expect(validatePassphraseStrength('correct-horse-battery-staple')).toBeNull();
  });

  it('rejects a passphrase shorter than MIN_PASSPHRASE_LENGTH', () => {
    expect(validatePassphraseStrength('short1')).toBe(
      `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`,
    );
  });

  it('rejects a passphrase with too few distinct characters', () => {
    expect(validatePassphraseStrength('aaaaaaaa')).toBe(
      'Passphrase is too repetitive — use a mix of different characters.',
    );
  });

  it('rejects a passphrase with too few distinct characters even with digits repeated', () => {
    expect(validatePassphraseStrength('11111111')).toBe(
      'Passphrase is too repetitive — use a mix of different characters.',
    );
  });

  it('rejects a common weak passphrase (case-insensitive)', () => {
    expect(validatePassphraseStrength('Password1')).toBe(
      'This passphrase is too common — choose something more unique.',
    );
  });

  it('accepts a passphrase with exactly 4 distinct characters', () => {
    expect(validatePassphraseStrength('abcdabcd')).toBeNull();
  });
});
