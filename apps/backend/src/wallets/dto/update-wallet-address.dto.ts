import { ApiProperty } from '@nestjs/swagger';
import { IsEthereumAddress } from 'class-validator';

export class UpdateWalletAddressDto {
  @ApiProperty({ example: '0xAbC1230000000000000000000000000000dEaD' })
  @IsEthereumAddress()
  walletAddress!: string;
}
