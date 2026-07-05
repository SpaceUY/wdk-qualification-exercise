import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WdkAppNodeController } from './wdk-app-node.controller';
import { WdkAppNodeService } from './wdk-app-node.service';

@Module({
  imports: [AuthModule],
  controllers: [WdkAppNodeController],
  providers: [WdkAppNodeService],
})
export class WdkAppNodeModule {}
