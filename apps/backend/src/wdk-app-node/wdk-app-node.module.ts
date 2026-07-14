import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RedisCacheModule } from '../redis/redis-cache.module';
import { WdkAppNodeController } from './wdk-app-node.controller';
import { WdkAppNodeService } from './wdk-app-node.service';
import { TokenTransfersService } from './token-transfers.service';

@Module({
  imports: [AuthModule, RedisCacheModule],
  controllers: [WdkAppNodeController],
  providers: [WdkAppNodeService, TokenTransfersService],
})
export class WdkAppNodeModule {}
