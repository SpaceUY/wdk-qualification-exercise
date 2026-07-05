import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { validateSync } from 'class-validator';
import { Model } from 'mongoose';
import { WdkService } from '../../../wdk/wdk.service';
import { IndexerState, IndexerStateDocument } from '../entities/indexer-state.entity';
import { TransferEventDto } from '../dto/transfer-event.dto';
import { TransferStreamPort } from '../ports/transfer-stream.port';
import { TRANSFER_FIELD_CANDIDATES, pickString } from './field-mapping.util';

const CHAIN = 'sepolia' as const;

// Plain REST polling has no internal wait — preserves the previous 30s cron cadence.
const POLL_INTERVAL_MS = 30_000;

// wdk-api.tether.io's per-item /token-transfers field names are not documented anywhere
// we have access to (confirmed only the top-level `{ transfers: [...] }` envelope and the
// unrelated /token-balances shape live). Several candidate names are tried per field so a
// real payload has a good chance of matching; adjust TRANSFER_FIELD_CANDIDATES once real
// transfers are observed in dev.
const FIELD_CANDIDATES = TRANSFER_FIELD_CANDIDATES;

@Injectable()
export class WdkIndexerTransferAdapter extends TransferStreamPort {
  private readonly logger = new Logger(WdkIndexerTransferAdapter.name);

  constructor(
    private readonly wdkService: WdkService,
    private readonly configService: ConfigService,
    @InjectModel(IndexerState.name)
    private readonly stateModel: Model<IndexerStateDocument>,
  ) {
    super();
  }

  pollIntervalMs(): number {
    return POLL_INTERVAL_MS;
  }

  async read(): Promise<TransferEventDto[]> {
    const merchantAddresses =
      this.configService.get<string[]>('blockchain.merchantAddresses') ?? [];

    const results = await Promise.all(
      merchantAddresses.map((address) => this.readForMerchant(address)),
    );
    return results.flat();
  }

  private async readForMerchant(merchantAddress: string): Promise<TransferEventDto[]> {
    let rawTransfers: unknown[];
    try {
      rawTransfers = await this.wdkService.getUsdtTransfers(CHAIN, merchantAddress);
    } catch (err) {
      this.logger.error(`Failed to poll transfers for merchant ${merchantAddress}`, err);
      return [];
    }

    const state = await this.stateModel.findOne({ _id: merchantAddress }).lean();
    const seen = new Set(state?.seenTxHashes ?? []);

    const events: TransferEventDto[] = [];
    const newHashes: string[] = [];

    for (const raw of rawTransfers) {
      const event = this.toTransferEvent(raw, merchantAddress);
      if (!event || seen.has(event.txHash)) continue;
      events.push(event);
      newHashes.push(event.txHash);
    }

    if (newHashes.length > 0) {
      const merged = [...seen, ...newHashes].slice(-Math.max(rawTransfers.length, 1));
      await this.stateModel.findOneAndUpdate(
        { _id: merchantAddress },
        { seenTxHashes: merged },
        { upsert: true },
      );
    }

    return events;
  }

  private toTransferEvent(raw: unknown, merchantAddress: string): TransferEventDto | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const item = raw as Record<string, unknown>;

    const from = pickString(item, FIELD_CANDIDATES.from);
    const to = pickString(item, FIELD_CANDIDATES.to);
    const amount = pickString(item, FIELD_CANDIDATES.amount);
    const txHash = pickString(item, FIELD_CANDIDATES.txHash);

    if (!from || !to || !amount || !txHash) {
      this.logger.warn(
        `Skipping malformed transfer for merchant ${merchantAddress} — missing expected field(s), keys=[${Object.keys(item).join(',')}]`,
      );
      return null;
    }

    const event = new TransferEventDto();
    event.from = from;
    event.to = to;
    event.amount = amount;
    event.txHash = txHash;
    event.chain = CHAIN;

    const errors = validateSync(event);
    if (errors.length > 0) {
      this.logger.warn(`Skipping invalid transfer for merchant ${merchantAddress}: ${errors.join(', ')}`);
      return null;
    }

    return event;
  }
}
