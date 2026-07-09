import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { cognitoConfig } from './config/cognito.config';
import { databaseConfig } from './config/database.config';
import { blockchainConfig } from './config/blockchain.config';
import { wdkIndexerConfig } from './config/wdk-indexer.config';
import { redisConfig } from './config/redis.config';
import { wdkEventBusConfig } from './config/wdk-event-bus.config';
import { indexerConfig } from './config/indexer.config';
import { wdkAppNodeConfig } from './config/wdk-app-node.config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WalletsModule } from './wallets/wallets.module';
import { CouponsModule } from './coupons/coupons.module';
import { MerchantsModule } from './merchants/merchants.module';
import { IndexerModule } from './modules/indexer/indexer.module';
import { WdkModule } from './wdk/wdk.module';
import { WdkAppNodeModule } from './wdk-app-node/wdk-app-node.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        cognitoConfig,
        databaseConfig,
        blockchainConfig,
        wdkIndexerConfig,
        redisConfig,
        wdkEventBusConfig,
        indexerConfig,
        wdkAppNodeConfig,
      ],
      envFilePath: ['.env.local', '.env'],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('database.uri'),
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.getOrThrow<string>('redis.host'),
          port: config.getOrThrow<number>('redis.port'),
        },
      }),
    }),
    AuthModule,
    UsersModule,
    WalletsModule,
    CouponsModule,
    MerchantsModule,
    IndexerModule,
    WdkModule,
    WdkAppNodeModule,
    HealthModule,
  ],
})
export class AppModule {}
