import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PRICE_HISTORY_RANGES, PriceHistoryRange } from '../prices.service';

export class PriceHistoryQueryDto {
  @ApiPropertyOptional({
    enum: PRICE_HISTORY_RANGES,
    default: '1d',
    description: 'Time window for the price series',
  })
  @IsOptional()
  @IsIn(PRICE_HISTORY_RANGES)
  range: PriceHistoryRange = '1d';
}
