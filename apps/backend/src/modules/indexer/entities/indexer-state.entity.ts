import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// One document per monitored merchant address (keyed by _id = merchantAddress) — tracks
// recently-seen tx hashes so the poll-based adapter doesn't re-enqueue transfers it already
// dispatched. Bounded to the size of the API's `limit` window; exact duplicates are additionally
// caught by the unique index on coupons.txHash, so this is an optimization, not the correctness backstop.
@Schema({ collection: 'indexer_states', _id: false, timestamps: { createdAt: false, updatedAt: true } })
export class IndexerState {
  @Prop({ type: String, required: true })
  _id!: string;

  @Prop({ type: [String], default: [] })
  seenTxHashes!: string[];
}

export type IndexerStateDocument = HydratedDocument<IndexerState>;
export const IndexerStateSchema = SchemaFactory.createForClass(IndexerState);
