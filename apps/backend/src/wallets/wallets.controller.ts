import { Body, Controller, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { WalletsService } from './wallets.service';
import { UsersService } from '../users/users.service';
import { BackupWalletDto } from './dto/backup-wallet.dto';
import { UpdateWalletAddressDto } from './dto/update-wallet-address.dto';

@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly usersService: UsersService,
  ) {}

  @Post('backup')
  async backup(
    @CurrentUser() authUser: AuthenticatedUser,
    @Body() dto: BackupWalletDto,
  ): Promise<{ id: string }> {
    const user = await this.usersService.findOrCreate({
      cognitoSub: authUser.sub,
      email: authUser.email,
    });
    const backup = await this.walletsService.upsertBackup(user.id, dto.ciphertext);
    return { id: backup.id };
  }

  @Put('address')
  async updateAddress(
    @CurrentUser() authUser: AuthenticatedUser,
    @Body() dto: UpdateWalletAddressDto,
  ): Promise<{ walletAddress: string }> {
    const user = await this.usersService.findOrCreate({
      cognitoSub: authUser.sub,
      email: authUser.email,
    });
    const updated = await this.usersService.updateWalletAddress(user.id, dto.walletAddress);
    return { walletAddress: updated.walletAddress as string };
  }
}
