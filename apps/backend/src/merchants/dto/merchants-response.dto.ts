import { ApiProperty } from '@nestjs/swagger';

export class MerchantsResponseDto {
  @ApiProperty({ type: [String], description: 'Lowercase merchant addresses eligible for cashback' })
  addresses!: string[];

  @ApiProperty({
    type: Object,
    description: 'Lowercase merchant address to display name, only present for addresses with a known name',
  })
  names!: Record<string, string>;

  @ApiProperty({ description: 'Current cashback rate as a fraction, e.g. 0.05 for 5%' })
  cashbackRate!: number;
}
