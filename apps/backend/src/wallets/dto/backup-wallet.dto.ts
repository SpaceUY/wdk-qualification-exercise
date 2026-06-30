import { IsBase64, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * SECURITY: This DTO accepts ONLY client-side AES-GCM encrypted ciphertext
 * (base64-encoded). Raw seed phrases or private keys must never reach this
 * endpoint. Strict validation at the HTTP boundary rejects obviously wrong payloads
 * before any persistence occurs.
 */
export class BackupWalletDto {
  @IsString()
  @IsNotEmpty()
  @IsBase64()
  @MaxLength(65535)
  ciphertext!: string;
}
