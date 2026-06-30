import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// Singleton per chain — exactly one row keyed by chain identifier
@Entity('listener_states')
export class ListenerState {
  @PrimaryColumn({ length: 64 })
  chainKey!: string;

  @Column({ type: 'int', default: 0 })
  lastProcessedBlock!: number;

  @UpdateDateColumn()
  updatedAt!: Date;
}
