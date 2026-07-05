import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { TransferConsumerService } from './transfer-consumer.service';
import { TransferStreamPort } from '../ports/transfer-stream.port';
import { TransferEventDto } from '../dto/transfer-event.dto';

function makeEvent(txHash: string): TransferEventDto {
  const event = new TransferEventDto();
  event.from = '0xsender';
  event.to = '0xmerchant';
  event.amount = '1000000';
  event.txHash = txHash;
  event.chain = 'sepolia';
  return event;
}

describe('TransferConsumerService', () => {
  let consumer: TransferConsumerService;
  let stream: jest.Mocked<TransferStreamPort>;
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    stream = {
      read: jest.fn(),
      pollIntervalMs: jest.fn().mockReturnValue(0),
    } as unknown as jest.Mocked<TransferStreamPort>;
    queue = { add: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferConsumerService,
        { provide: TransferStreamPort, useValue: stream },
        { provide: getQueueToken('transfers'), useValue: queue },
      ],
    }).compile();

    consumer = module.get(TransferConsumerService);
  });

  describe('poll', () => {
    it('enqueues one job per event returned by the port and reports no error', async () => {
      stream.read.mockResolvedValue([makeEvent('0xtx1'), makeEvent('0xtx2')]);

      await expect(consumer.poll()).resolves.toBe(false);

      expect(queue.add).toHaveBeenCalledTimes(2);
      expect(queue.add).toHaveBeenCalledWith('process-transfer', expect.objectContaining({ txHash: '0xtx1' }));
      expect(queue.add).toHaveBeenCalledWith('process-transfer', expect.objectContaining({ txHash: '0xtx2' }));
    });

    it('does not throw and reports an error when the port read fails', async () => {
      stream.read.mockRejectedValue(new Error('boom'));

      await expect(consumer.poll()).resolves.toBe(true);
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('the continuous loop', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(async () => {
      await consumer.onModuleDestroy();
      jest.useRealTimers();
    });

    it('keeps calling read() after module init, spaced by the stream pollIntervalMs', async () => {
      stream.pollIntervalMs.mockReturnValue(1000);
      stream.read.mockResolvedValue([]);

      consumer.onModuleInit();
      await jest.advanceTimersByTimeAsync(0); // let the first (immediate) read() happen
      expect(stream.read).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1000);
      expect(stream.read).toHaveBeenCalledTimes(2);

      await jest.advanceTimersByTimeAsync(1000);
      expect(stream.read).toHaveBeenCalledTimes(3);
    });

    it('stops calling read() once module destroy resolves', async () => {
      stream.pollIntervalMs.mockReturnValue(1000);
      stream.read.mockResolvedValue([]);

      consumer.onModuleInit();
      await jest.advanceTimersByTimeAsync(2000);
      const callsBeforeDestroy = stream.read.mock.calls.length;

      await consumer.onModuleDestroy();
      await jest.advanceTimersByTimeAsync(5000);

      expect(stream.read.mock.calls.length).toBe(callsBeforeDestroy);
    });

    it('backs off after a failed poll using its own interval, not the stream pollIntervalMs', async () => {
      // A large, clearly-distinct interval so a retry landing at ~1000ms (the backoff window)
      // rather than 5000ms (the stream's normal interval) is unambiguous. Deliberately not 0
      // here — an unbroken chain of zero-delay timers never terminates a fake-timer advancement.
      stream.pollIntervalMs.mockReturnValue(5000);
      stream.read.mockRejectedValueOnce(new Error('boom')).mockResolvedValue([]);

      consumer.onModuleInit();
      await jest.advanceTimersByTimeAsync(0);
      expect(stream.read).toHaveBeenCalledTimes(1); // the failed call

      await jest.advanceTimersByTimeAsync(999);
      expect(stream.read).toHaveBeenCalledTimes(1); // still backing off

      await jest.advanceTimersByTimeAsync(1);
      expect(stream.read).toHaveBeenCalledTimes(2); // retried once the (shorter) backoff elapsed
    });
  });

  it('breaks out of the loop immediately when destroy resolves while a poll is still in flight', async () => {
    jest.useRealTimers();
    let resolveRead!: (events: TransferEventDto[]) => void;
    stream.pollIntervalMs.mockReturnValue(1000);
    stream.read
      .mockImplementationOnce(() => new Promise((resolve) => { resolveRead = resolve; }))
      .mockResolvedValue([]);

    consumer.onModuleInit();
    await new Promise((resolve) => setImmediate(resolve)); // let the in-flight read() start

    const destroyPromise = consumer.onModuleDestroy();
    resolveRead([]); // poll() resolves after `stopped` was already set to true
    await destroyPromise;

    // Only the one in-flight read() happened — no delay()-then-retry cycle after it broke out.
    expect(stream.read).toHaveBeenCalledTimes(1);
  });

  // Real timers here, deliberately — a pollIntervalMs() of 0 makes the loop schedule an
  // unbroken chain of zero-delay timers, which never terminates under Jest's fake-timer engine
  // (each new timer is "due now" relative to a virtual clock that a zero delay never advances).
  it('iterates back-to-back with no meaningful pause when pollIntervalMs is 0', async () => {
    stream.pollIntervalMs.mockReturnValue(0);
    stream.read.mockResolvedValue([]);

    consumer.onModuleInit();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await consumer.onModuleDestroy();

    expect(stream.read.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
