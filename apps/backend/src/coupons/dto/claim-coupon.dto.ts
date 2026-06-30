import { IsHexadecimal, IsString, Length } from 'class-validator';

export class ClaimCouponDto {
  @IsString()
  @IsHexadecimal()
  @Length(32, 32)
  code!: string;
}
