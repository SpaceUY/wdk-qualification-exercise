import { IsEthereumAddress } from 'class-validator';

export class UpdateWalletAddressDto {
  @IsEthereumAddress()
  walletAddress!: string;
}
