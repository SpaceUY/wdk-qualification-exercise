import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { DefaultNamingStrategy, type NamingStrategyInterface } from 'typeorm';
import { cognitoConfig } from './config/cognito.config';
import { databaseConfig } from './config/database.config';
import { blockchainConfig } from './config/blockchain.config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WalletsModule } from './wallets/wallets.module';
import { CouponsModule } from './coupons/coupons.module';
import { ListenerModule } from './listener/listener.module';
import { WdkModule } from './wdk/wdk.module';
import { User } from './users/entities/user.entity';
import { EncryptedBackup } from './wallets/entities/encrypted-backup.entity';
import { Coupon } from './coupons/entities/coupon.entity';
import { ListenerState } from './listener/entities/listener-state.entity';

class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  override columnName(
    propertyName: string,
    customName: string,
    embeddedPrefixes: string[],
  ): string {
    const name = customName ?? propertyName;
    return embeddedPrefixes
      .concat(name)
      .join('_')
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }

  override tableName(targetName: string, userSpecifiedName: string | undefined): string {
    return userSpecifiedName ?? targetName;
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [cognitoConfig, databaseConfig, blockchainConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        entities: [User, EncryptedBackup, Coupon, ListenerState],
        synchronize: process.env['NODE_ENV'] !== 'production',
        namingStrategy: new SnakeNamingStrategy(),
        logging: process.env['NODE_ENV'] !== 'production',
      }),
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    WalletsModule,
    CouponsModule,
    ListenerModule,
    WdkModule,
  ],
})
export class AppModule {}
