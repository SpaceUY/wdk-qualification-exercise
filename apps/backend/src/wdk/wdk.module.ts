import { Module } from '@nestjs/common';
import { WdkService } from './wdk.service';

@Module({
  providers: [WdkService],
  exports: [WdkService],
})
export class WdkModule {}
