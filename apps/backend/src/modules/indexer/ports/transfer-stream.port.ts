import { TransferEventDto } from '../dto/transfer-event.dto';

export abstract class TransferStreamPort {
  abstract read(): Promise<TransferEventDto[]>;

  // How long the consumer loop should wait after a read() call before calling again.
  // A blocking stream implementation (e.g. Redis XREADGROUP with BLOCK) already paces
  // itself internally and should return 0; a plain request/response poller (e.g. a REST
  // API) has no such internal wait and must specify one here.
  abstract pollIntervalMs(): number;
}
