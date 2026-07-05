import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'encrypted_backups', timestamps: true })
export class EncryptedBackup {
  // Not a @Prop — Mongoose's default `id` virtual (string form of `_id`), declared
  // here only so TypeScript recognizes it on hydrated documents.
  id!: string;

  @Prop({ type: String, required: true, unique: true })
  userId!: string;

  /**
   * Client-side AES-GCM encrypted seed ciphertext, base64-encoded.
   * SECURITY: Must NEVER contain raw seed phrases or private keys.
   * BackupWalletDto enforces @IsBase64() + @MaxLength(65535) at the API boundary.
   */
  @Prop({ type: String, required: true })
  ciphertext!: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export type EncryptedBackupDocument = HydratedDocument<EncryptedBackup>;
export const EncryptedBackupSchema = SchemaFactory.createForClass(EncryptedBackup);
