import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from '../../users/entities/user.entity';

@Entity('encrypted_backups')
export class EncryptedBackup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne('User', (u: User) => u.encryptedBackup, { onDelete: 'CASCADE' })
  @JoinColumn()
  user!: User;

  @RelationId((backup: EncryptedBackup) => backup.user)
  userId!: string;

  /**
   * Client-side AES-GCM encrypted seed ciphertext, base64-encoded.
   * SECURITY: Must NEVER contain raw seed phrases or private keys.
   * BackupWalletDto enforces @IsBase64() + @MaxLength(65535) at the API boundary.
   */
  @Column({ type: 'text' })
  ciphertext!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
