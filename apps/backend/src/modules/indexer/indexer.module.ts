import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../../users/users.module';
import { WdkModule } from '../../wdk/wdk.module';
import { Coupon, CouponSchema } from '../../coupons/entities/coupon.entity';
import { IndexerState, IndexerStateSchema } from './entities/indexer-state.entity';
import { WdkIndexerTransferAdapter } from './adapters/wdk-indexer-transfer.adapter';
import { RedisStreamTransferAdapter } from './adapters/redis-stream-transfer.adapter';
import { TransferConsumerService } from './consumers/transfer-consumer.service';
import { TransferProcessor } from './processors/transfer.processor';
import { transferStreamProvider } from './transfer-stream.provider';
import { WdkEventBusModule } from './wdk-event-bus/wdk-event-bus.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Coupon.name, schema: CouponSchema },
      { name: IndexerState.name, schema: IndexerStateSchema },
    ]),
    BullModule.registerQueue({ name: 'transfers' }),
    UsersModule,
    WdkModule, // kept for the hosted-api rollback path
    WdkEventBusModule,
  ],
  providers: [
    WdkIndexerTransferAdapter, // legacy — always registered, active only when INDEXER_TRANSPORT=hosted-api
    RedisStreamTransferAdapter, // default
    transferStreamProvider,
    TransferConsumerService,
    TransferProcessor,
  ],
})
export class IndexerModule {}
