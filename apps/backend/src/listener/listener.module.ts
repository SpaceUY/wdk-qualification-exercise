import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { Coupon } from '../coupons/entities/coupon.entity';
import { ListenerState } from './entities/listener-state.entity';
import { ListenerService } from './listener.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ListenerState, Coupon]),
    UsersModule,
  ],
  providers: [ListenerService],
})
export class ListenerModule {}
