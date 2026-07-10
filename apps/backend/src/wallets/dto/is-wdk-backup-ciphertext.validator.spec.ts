import { ValidationArguments } from 'class-validator';
import { IsWdkBackupCiphertextConstraint } from './is-wdk-backup-ciphertext.validator';

describe('IsWdkBackupCiphertextConstraint', () => {
  const constraint = new IsWdkBackupCiphertextConstraint();

  function buildValidBlob(totalLength = 45): string {
    const blob = Buffer.alloc(totalLength, 0);
    blob[0] = 0x01;
    return blob.toString('base64');
  }

  it('accepts a correctly-shaped blob at the minimum length', () => {
    expect(constraint.validate(buildValidBlob())).toBe(true);
  });

  it('accepts a longer blob (real ciphertext is longer than the minimum)', () => {
    expect(constraint.validate(buildValidBlob(61))).toBe(true);
  });

  it('rejects a non-string value', () => {
    expect(constraint.validate(12345)).toBe(false);
  });

  it('rejects a value that is too short', () => {
    const blob = Buffer.alloc(10, 0);
    blob[0] = 0x01;
    expect(constraint.validate(blob.toString('base64'))).toBe(false);
  });

  it('accepts every version byte the app has ever written (0x02, 0x03, 0x04)', () => {
    for (const version of [0x02, 0x03, 0x04]) {
      const blob = Buffer.alloc(45, 0);
      blob[0] = version;
      expect(constraint.validate(blob.toString('base64'))).toBe(true);
    }
  });

  it('accepts future version bytes within the reserved range without a backend redeploy', () => {
    const blob = Buffer.alloc(45, 0);
    blob[0] = 0x0f;
    expect(constraint.validate(blob.toString('base64'))).toBe(true);
  });

  it('rejects a zero version byte (never a valid version)', () => {
    const blob = Buffer.alloc(45, 0);
    blob[0] = 0x00;
    expect(constraint.validate(blob.toString('base64'))).toBe(false);
  });

  it('rejects a version byte outside the reserved range (arbitrary binary junk)', () => {
    const blob = Buffer.alloc(45, 0);
    blob[0] = 0x10;
    expect(constraint.validate(blob.toString('base64'))).toBe(false);
  });

  it('rejects a plain base64-encoded plaintext string (the exact bug this closes)', () => {
    const plaintextBase64 = Buffer.from(
      'this is not a real seed phrase ciphertext',
    ).toString('base64');
    expect(constraint.validate(plaintextBase64)).toBe(false);
  });

  it('provides a defaultMessage', () => {
    expect(constraint.defaultMessage({} as ValidationArguments)).toContain('WDK backup blob');
  });
});
