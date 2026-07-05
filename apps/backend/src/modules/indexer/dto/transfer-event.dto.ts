import { IsOptional, IsString } from 'class-validator';

export class TransferEventDto {
  @IsString()
  from!: string;

  @IsString()
  to!: string;

  // Raw USDT amount (6 decimals) as a string, to preserve precision
  @IsString()
  amount!: string;

  @IsString()
  txHash!: string;

  @IsString()
  chain!: string;

  @IsOptional()
  @IsString()
  token?: string;
}
