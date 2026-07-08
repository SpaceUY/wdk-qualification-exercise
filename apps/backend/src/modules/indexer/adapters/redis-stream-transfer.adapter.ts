import { randomUUID } from 'crypto';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validateSync } from 'class-validator';
import type Redis from 'ioredis';
import { WDK_EVENT_BUS_CLIENT } from '../wdk-event-bus/wdk-event-bus.tokens';
import { TransferEventDto } from '../dto/transfer-event.dto';
import { TransferStreamPort } from '../ports/transfer-stream.port';
import {
  decimalToRawUnits,
  GROUPED_TRANSACTION_MSG_TYPE,
  parseGroupedTransactionRaw,
} from './grouped-transaction.util';

type StreamReadResult = [string, [string, string[]][]][] | null;

// This project only ever indexes USDT, which is hardcoded at 6 decimals elsewhere too
// (see TransferProcessor's DECIMAL_ADJUSTMENT constant).
const USDT_DECIMALS = 6;

// indexer-processor (a required, always-running piece of the self-hosted stack — app-node's
// balance/token-transfer endpoints depend on it) runs its own consumer group on this same
// stream and XDELs each message right after processing, which physically removes it for every
// consumer group, not just its own. A cold, infrequent poll loses that race almost every time;
// blocking on XREADGROUP wakes us at essentially the same moment Redis wakes the competing
// consumer. Matches the BLOCK duration observed on indexer-processor's own XREADGROUP calls.
const XREADGROUP_BLOCK_MS = 5000;

@Injectable()
export class RedisStreamTransferAdapter extends TransferStreamPort implements OnModuleInit {
  private readonly logger = new Logger(RedisStreamTransferAdapter.name);
  private readonly consumerName = `consumer-${process.pid}-${randomUUID().slice(0, 8)}`;

  constructor(
    @Inject(WDK_EVENT_BUS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    if (this.configService.get('indexer.transport') !== 'redis-stream') return;
    await this.ensureConsumerGroup();
  }

  // The XREADGROUP call below already blocks for XREADGROUP_BLOCK_MS, so the consumer loop
  // needs no additional artificial delay between calls.
  pollIntervalMs(): number {
    return 0;
  }

  private async ensureConsumerGroup(): Promise<void> {
    const { streamKey, consumerGroup } = this.streamConfig();
    try {
      await this.redis.xgroup('CREATE', streamKey, consumerGroup, '$', 'MKSTREAM');
    } catch (err) {
      if (!(err as Error).message.includes('BUSYGROUP')) {
        this.logger.error('Failed to create consumer group', err);
      }
    }
  }

  async read(): Promise<TransferEventDto[]> {
    const { streamKey, consumerGroup } = this.streamConfig();
    const merchantAddresses = new Set(
      (this.configService.get<string[]>('blockchain.merchantAddresses') ?? []).map((a) => a.toLowerCase()),
    );

    let raw: StreamReadResult;
    try {
      raw = (await this.redis.xreadgroup(
        'GROUP', consumerGroup, this.consumerName, 'COUNT', '200',
        'BLOCK', XREADGROUP_BLOCK_MS,
        'STREAMS', streamKey, '>',
      )) as StreamReadResult;
    } catch (err) {
      this.logger.error(`XREADGROUP failed on ${streamKey}`, err);
      return [];
    }
    if (!raw) return [];

    const events: TransferEventDto[] = [];
    const idsToAck: string[] = [];
    for (const [, messages] of raw) {
      for (const [id, fields] of messages) {
        // ack regardless of match — a filtered-out message must not be redelivered forever
        idsToAck.push(id);
        events.push(...this.toTransferEvents(fields, merchantAddresses));
      }
    }
    if (idsToAck.length > 0) {
      await this.redis.xack(streamKey, consumerGroup, ...idsToAck)
        .catch((err) => this.logger.warn(`Failed to XACK ${idsToAck.length} message(s)`, err));
    }
    return events;
  }

  // A single stream message can carry several transfers (grouped by transaction hash) — see
  // grouped-transaction.util.ts for the raw wire format.
  private toTransferEvents(fields: string[], merchantAddresses: Set<string>): TransferEventDto[] {
    const item = this.flatFieldsToRecord(fields);

    if (item['type'] !== GROUPED_TRANSACTION_MSG_TYPE || !item['raw']) {
      this.logger.warn(`Skipping stream message with unexpected type=${item['type']}`);
      return [];
    }

    const events: TransferEventDto[] = [];
    for (const transfer of parseGroupedTransactionRaw(item['raw'])) {
      if (!transfer.from || !transfer.to || !transfer.amount || !transfer.txHash) {
        this.logger.warn('Skipping malformed grouped transfer — missing expected field(s)');
        continue;
      }
      // every transfer for the chain/token pair arrives here, not just merchant-bound ones —
      // filter here rather than relying solely on TransferProcessor's downstream check
      if (!merchantAddresses.has(transfer.to.toLowerCase())) continue;

      const rawAmount = decimalToRawUnits(transfer.amount, USDT_DECIMALS);
      if (rawAmount === null) {
        this.logger.warn(`Skipping transfer ${transfer.txHash} with unparsable amount "${transfer.amount}"`);
        continue;
      }

      const event = new TransferEventDto();
      event.from = transfer.from;
      event.to = transfer.to;
      event.amount = rawAmount;
      event.txHash = transfer.txHash;
      event.chain = transfer.blockchain || 'ethereum';
      event.token = transfer.token;

      const errors = validateSync(event);
      if (errors.length > 0) {
        this.logger.warn(`Skipping invalid stream message: ${errors.join(', ')}`);
        continue;
      }
      events.push(event);
    }
    return events;
  }

  private flatFieldsToRecord(fields: string[]): Record<string, string> {
    const record: Record<string, string> = {};
    for (let i = 0; i < fields.length - 1; i += 2) {
      record[fields[i] as string] = fields[i + 1] as string;
    }
    return record;
  }

  private streamConfig(): { streamKey: string; consumerGroup: string } {
    return {
      streamKey: this.configService.getOrThrow<string>('wdkEventBus.streamKey'),
      consumerGroup: this.configService.getOrThrow<string>('wdkEventBus.consumerGroup'),
    };
  }
}
