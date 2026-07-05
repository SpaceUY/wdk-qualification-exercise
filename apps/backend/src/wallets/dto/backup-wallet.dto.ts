import { ApiProperty } from '@nestjs/swagger';
import { IsBase64, IsNotEmpty, IsString, MaxLength, Validate } from 'class-validator';
import { IsWdkBackupCiphertextConstraint } from './is-wdk-backup-ciphertext.validator';

/**
 * SECURITY: This DTO accepts ONLY client-side AES-256-GCM encrypted ciphertext, base64-encoded
 * in the versioned wire format: 1-byte version + 16-byte salt + 12-byte IV + ciphertext+tag
 * (see apps/rn-wdk-exercise/utils/seedEncryption.ts). Raw seed phrases or private keys must
 * never reach this endpoint. IsWdkBackupCiphertextConstraint enforces the wire format's actual
 * structure (length + version byte) — @IsBase64() alone only enforces charset/padding and
 * cannot distinguish real ciphertext from base64-encoded plaintext.
 */
export class BackupWalletDto {
  @ApiProperty({ description: 'Client-side AES-256-GCM encrypted wallet backup, base64-encoded' })
  @IsString()
  @IsNotEmpty()
  @IsBase64()
  @MaxLength(65535)
  @Validate(IsWdkBackupCiphertextConstraint)
  ciphertext!: string;
}
