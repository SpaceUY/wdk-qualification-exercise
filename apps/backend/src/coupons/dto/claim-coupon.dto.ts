import { ApiProperty } from '@nestjs/swagger';
import { IsHexadecimal, IsString, Length } from 'class-validator';

export class ClaimCouponDto {
  @ApiProperty({ description: '32-char hex coupon code', example: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6' })
  @IsString()
  @IsHexadecimal()
  @Length(32, 32)
  code!: string;
}
