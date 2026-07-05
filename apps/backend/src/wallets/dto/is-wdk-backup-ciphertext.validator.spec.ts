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

  it('accepts a version-0x02 blob (the new current version)', () => {
    const blob = Buffer.alloc(45, 0);
    blob[0] = 0x02;
    expect(constraint.validate(blob.toString('base64'))).toBe(true);
  });

  it('rejects a value with the wrong version byte', () => {
    const blob = Buffer.alloc(45, 0);
    blob[0] = 0x03;
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
