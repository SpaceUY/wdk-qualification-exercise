import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

// This validator never decrypts — it only checks shape before storing the blob verbatim,
// so it accepts a RANGE of version bytes rather than an exact allowlist. An exact list
// adds no security (the byte is attacker-forgeable) but must be redeployed in lockstep
// with every KDF hardening in apps/rn-wdk-exercise/utils/seedEncryption.ts — a sync that
// already broke once in production (the app shipped version 0x03 while this list still
// read [0x01, 0x02], turning every backup upload into a 400). The client rejects unknown
// versions on restore via its own SCRYPT_PARAMS_BY_VERSION table.
const MIN_VERSION_BYTE = 0x01;
const MAX_VERSION_BYTE = 0x0f; // headroom for future versions; raise deliberately if ever reached
const MIN_BLOB_LENGTH = 1 + 16 + 12 + 16; // version + salt + IV + 16-byte GCM tag

@ValidatorConstraint({ name: 'isWdkBackupCiphertext' })
export class IsWdkBackupCiphertextConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const decoded = Buffer.from(value, 'base64');
    return (
      decoded.length >= MIN_BLOB_LENGTH &&
      decoded[0] >= MIN_VERSION_BYTE &&
      decoded[0] <= MAX_VERSION_BYTE
    );
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'ciphertext must be a valid WDK backup blob (base64-encoded, versioned, minimum length for salt+IV+tag)';
  }
}
