import { ApiProperty } from '@nestjs/swagger';
import { PRICE_HISTORY_RANGES, PriceHistoryRange } from '../prices.service';

export class PriceHistoryPointDto {
  @ApiProperty({ description: 'Unix epoch timestamp in milliseconds' })
  timestamp!: number;

  @ApiProperty({ description: 'Price in USD at that timestamp' })
  price!: number;
}

export class PriceHistoryResponseDto {
  @ApiProperty({ example: 'BTC' })
  symbol!: string;

  @ApiProperty({ enum: PRICE_HISTORY_RANGES })
  range!: PriceHistoryRange;

  @ApiProperty({
    type: [PriceHistoryPointDto],
    description:
      'Chronological price series, downsampled to at most 300 points. Empty means the asset has no market (e.g. UTL) — clients must render "no data", never a flat $0 line.',
  })
  points!: PriceHistoryPointDto[];

  @ApiProperty({ description: 'ISO timestamp of when the series was fetched from the upstream provider' })
  fetchedAt!: string;
}
