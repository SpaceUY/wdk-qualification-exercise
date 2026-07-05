import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bull';
import { TransferStreamPort } from '../ports/transfer-stream.port';

// Applied instead of the stream's own pollIntervalMs() when a poll iteration throws, so an
// unexpected failure (e.g. a queue error) can't turn into a tight error loop.
const ERROR_BACKOFF_MS = 1000;

@Injectable()
export class TransferConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TransferConsumerService.name);
  private stopped = false;
  private loopPromise?: Promise<void>;
  // Lets onModuleDestroy wake a loop currently parked in delay() immediately, instead of
  // shutdown having to wait for that timer to fire naturally on its own.
  private wakeDelay: (() => void) | null = null;

  constructor(
    private readonly stream: TransferStreamPort,
    @InjectQueue('transfers') private readonly queue: Queue,
  ) {}

  onModuleInit(): void {
    this.loopPromise = this.loop();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    this.wakeDelay?.();
    await this.loopPromise;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.wakeDelay = null;
        resolve();
      }, ms);
      this.wakeDelay = () => {
        clearTimeout(timer);
        this.wakeDelay = null;
        resolve();
      };
    });
  }

  // Runs continuously for the lifetime of the app rather than on a fixed cron tick — a
  // blocking stream implementation (e.g. Redis XREADGROUP with BLOCK) needs its consumer to
  // always be listening to have any chance of winning a race against another consumer group
  // reading the same underlying stream. See RedisStreamTransferAdapter for the concrete case.
  private async loop(): Promise<void> {
    while (!this.stopped) {
      const errored = await this.poll();
      if (this.stopped) break;
      // Always yield via a real (macrotask) delay, even 0ms — read() can resolve without ever
      // actually blocking (e.g. data was already sitting in the stream), and a pollIntervalMs()
      // of 0 chained straight into another read() with no macrotask boundary between iterations
      // would starve the event loop's timer/I-O phases instead of just being a fast poll.
      const interval = errored ? ERROR_BACKOFF_MS : this.stream.pollIntervalMs();
      await this.delay(interval);
    }
  }

  // Runs a single read-and-enqueue cycle. Returns true if it failed, so the caller can back off.
  async poll(): Promise<boolean> {
    try {
      const events = await this.stream.read();
      for (const event of events) {
        await this.queue.add('process-transfer', event);
      }
      return false;
    } catch (err) {
      this.logger.error('poll error', err);
      return true;
    }
  }
}
