import { ApiProperty } from '@nestjs/swagger';

export class PricesResponseDto {
  @ApiProperty({
    type: Object,
    description:
      'Asset symbol to spot price in USD. null means the asset has no market price (e.g. UTL) and clients must not render it as $0.',
    example: { ETH: 3521.4, BTC: 97810, sBTC: 97810, USDT: 1.0, UTL: null },
  })
  prices!: Record<string, number | null>;

  @ApiProperty({ description: 'ISO timestamp of when the prices were fetched from the upstream provider' })
  fetchedAt!: string;
}
