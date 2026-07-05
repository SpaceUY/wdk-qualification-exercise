import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

// Must stay in sync with apps/rn-wdk-exercise/utils/seedEncryption.ts's SCRYPT_PARAMS_BY_VERSION keys.
// This validator never decrypts — it only checks shape/version before storing the blob verbatim.
const VALID_VERSION_BYTES = new Set([0x01, 0x02]);
const MIN_BLOB_LENGTH = 1 + 16 + 12 + 16; // version + salt + IV + 16-byte GCM tag

@ValidatorConstraint({ name: 'isWdkBackupCiphertext' })
export class IsWdkBackupCiphertextConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const decoded = Buffer.from(value, 'base64');
    return decoded.length >= MIN_BLOB_LENGTH && VALID_VERSION_BYTES.has(decoded[0]);
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'ciphertext must be a valid WDK backup blob (base64-encoded, versioned, minimum length for salt+IV+tag)';
  }
}
